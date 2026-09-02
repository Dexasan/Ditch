import { timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { supabaseAdmin, verifyAccessToken, verifyServiceTicket } from "@ditch/db";
import { validateEnv } from "./lib/env.js";
import { spawnFfmpeg, sanitizeEncoderParams, type FfmpegSession } from "./lib/ffmpeg.js";
import { createHlsPublisher, isHlsConfigured, type HlsPublisher } from "./lib/hls.js";
import { startRtmpIngest, type RtmpIngestController } from "./lib/ingest.js";

validateEnv();

const PORT = Number(process.env.RELAY_PORT ?? process.env.PORT) || 3003;
const MAX_ACTIVE_STREAMS = Math.max(1, Number(process.env.MAX_ACTIVE_STREAMS) || 4);
let rtmpIngest: RtmpIngestController | null = null;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim());
  if (explicit.includes(origin)) return true;
  return false;
}

// HTTP server handles Railway health checks; WebSocket server piggybacks on it
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const path = req.url?.split("?")[0];
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (req.method !== "GET" || !["/", "/health", "/internal/health"].includes(path ?? "")) {
    res.writeHead(404, headers); res.end(JSON.stringify({ error: "Not found" })); return;
  }
  if (path !== "/internal/health") {
    res.writeHead(200, headers); res.end(JSON.stringify({ status: "ok" })); return;
  }
  const expected = process.env.RELAY_HEALTH_TOKEN;
  const provided = req.headers.authorization?.replace(/^Bearer /, "");
  if (!expected || !provided || Buffer.byteLength(expected) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    res.writeHead(401, headers); res.end(JSON.stringify({ error: "Unauthorized" })); return;
  }
  res.writeHead(200, headers);
  res.end(JSON.stringify({ status: "ok", active_streams: activeSessions.size,
    max_active_streams: MAX_ACTIVE_STREAMS, hls_enabled: isHlsConfigured(),
    rtmp_ingest_enabled: Boolean(rtmpIngest), active_ingests: rtmpIngest?.activeCount() ?? 0,
    uptime_seconds: Math.round(process.uptime()) }));
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 8 * 1024 * 1024,
  verifyClient: ({ origin }: { origin: string }) => isOriginAllowed(origin),
});

// Keyed by session_id. Ensures at most one ffmpeg process per session across
// all WebSocket connections — kills any stale process before spawning a new one.
const activeSessions = new Map<string, FfmpegSession>();

wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
  const authDeadline = setTimeout(() => ws.close(1008, "Authentication required"), 10_000);
  authDeadline.unref();
  let checkingSession = false;
  const statePoll = setInterval(async () => {
    if (!currentSessionId || checkingSession) return;
    checkingSession = true;
    try {
      const { data, error } = await supabaseAdmin!.from("live_sessions").select("status").eq("id", currentSessionId).single();
      if (!error && (!data || data.status === "ended" || data.status === "ending")) { await session?.stop(); ws.close(1008, "Session ended"); }
    } finally { checkingSession = false; }
  }, 5000);
  statePoll.unref();
  ws.once("close", () => { clearTimeout(authDeadline); clearInterval(statePoll); });
  let session: FfmpegSession | null = null;
  let currentSessionId: string | null = null;
  let startReceivedAt: number | null = null;
  let firstMediaReceived = false;
  let hlsPublisher: HlsPublisher | null = null;
  let hlsUrl: string | null = null;

  ws.on("message", async (data, isBinary) => {
    // Binary frame: raw video chunk — pipe straight to ffmpeg stdin
    if (isBinary) {
      if (session) {
        if (!firstMediaReceived) {
          firstMediaReceived = true;
          const relayElapsedMs = startReceivedAt ? Date.now() - startReceivedAt : null;
          if (process.env.NODE_ENV !== "production") console.log("[relay-perf] first media received", {
            session_id: currentSessionId,
            relay_elapsed_ms: relayElapsedMs,
            bytes: (data as Buffer).byteLength,
          });
          send(ws, { type: "first_media", relay_elapsed_ms: relayElapsedMs });
        }
        // Pause WebSocket reads while ffmpeg's stdin buffer is full. The drain
        // event resumes reads and propagates TCP backpressure to the browser.
        if (!session.write(data as Buffer)) ws.pause();
      }
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse((data as Buffer).toString());
    } catch {
      return;
    }

    if (!msg || typeof msg !== "object") return;
    if (msg.type === "start") {
      if (typeof msg.session_id !== "string" || !/^[0-9a-f-]{36}$/i.test(msg.session_id) || typeof msg.token !== "string" || msg.token.length > 8192) return;
      startReceivedAt = Date.now();
      firstMediaReceived = false;
      const { session_id, token } = msg as { session_id: string; token: string };
      const encoderParams = sanitizeEncoderParams(msg);

      // 1. Validate JWT - local signature check when SUPABASE_JWT_SECRET is
      // set, so stream start neither pays an Auth round trip nor breaks when
      // Supabase Auth is unreachable.
      const authStartedAt = Date.now();
      const authUser = await verifyServiceTicket(token, "relay", session_id) ?? await verifyAccessToken(token);
      const authMs = Date.now() - authStartedAt;
      if (!authUser) {
        send(ws, { type: "error", message: "Unauthorized", retryable: false });
        return;
      }
      clearTimeout(authDeadline);
      const userId = authUser.id;

      // 2 + 3. Verify ownership and fetch destinations in parallel
      type SessionWithChannel = { id: string; status: string; source_type: "browser" | "rtmp"; channels: { owner_id: string } };
      const databaseStartedAt = Date.now();
      const [{ data: sessionRow }, { data: destinations }] = await Promise.all([
        supabaseAdmin!
          .from("live_sessions")
          .select("id, status, source_type, channels!inner(owner_id)")
          .eq("id", session_id)
          .single(),
        supabaseAdmin!
          .from("stream_destinations")
          .select("rtmp_url, stream_key")
          .eq("session_id", session_id),
      ]);
      const databaseMs = Date.now() - databaseStartedAt;

      const row = sessionRow as SessionWithChannel | null;
      if (row?.status === "ended" || row?.status === "ending") {
        send(ws, { type: "error", message: "Session ended", retryable: false });
        return;
      }

      if (!row || row.channels.owner_id !== userId) {
        send(ws, { type: "error", message: "Forbidden", retryable: false });
        return;
      }
      if (row.source_type === "rtmp") {
        send(ws, {
          type: "error",
          message: "This session is armed for an external RTMP encoder",
          retryable: false,
        });
        return;
      }

      // With HLS configured the session still has somewhere to go, so an empty
      // RTMP destination list is only fatal when HLS is off.
      if (!destinations?.length && !isHlsConfigured()) {
        send(ws, {
          type: "error",
          message: "No active destinations configured for this session",
          retryable: false,
        });
        return;
      }

      const rtmpTargets = (destinations ?? []).map((d) => `${d.rtmp_url}/${d.stream_key}`);

      // 4. Kill any stale ffmpeg process for this session before spawning a new one.
      //    Guards against a second connection arriving before the first WS close
      //    propagates (e.g. tab reload, session recovery reconnect).
      const stale = activeSessions.get(session_id);
      if (!stale && activeSessions.size >= MAX_ACTIVE_STREAMS) {
        send(ws, { type: "error", code: "relay_capacity", message: "Relay is at capacity; retry another node" });
        return;
      }

      if (stale) {
        // Wait for the old process to actually die. It still owns the RTMP
        // sockets until it does, and Twitch/YouTube accept only one publisher
        // per stream key, so spawning over the top of it makes the newcomer
        // fail with "error opening: I/O error" and collapse the whole tee.
        if (process.env.NODE_ENV !== "production") console.log(`[relay] session ${session_id}: waiting for stale ffmpeg to exit before respawn`);
        await stale.stop();
        if (activeSessions.get(session_id) === stale) activeSessions.delete(session_id);
        if (process.env.NODE_ENV !== "production") console.log(`[relay] session ${session_id}: stale ffmpeg exited, respawning`);
      }

      // 5. Spawn ffmpeg
      let ffmpegSpawnMs = 0;
      let hlsSetupMs = 0;
      let publisher: HlsPublisher | null = null;
      hlsUrl = null;
      try {
        // HLS setup is awaited before the spawn timer starts so ffmpeg_spawn_ms
        // keeps measuring only the spawn itself.
        const hlsSetupStartedAt = Date.now();
        publisher = await createHlsPublisher(session_id);
        hlsSetupMs = Date.now() - hlsSetupStartedAt;
        hlsUrl = publisher?.publicUrl ?? null;
        const ffmpegSpawnStartedAt = Date.now();
        const ffmpeg = spawnFfmpeg(rtmpTargets, session_id, encoderParams, publisher?.playlistPath);
        ffmpegSpawnMs = Date.now() - ffmpegSpawnStartedAt;
        session = {
          ...ffmpeg,
          stop: async () => { await ffmpeg.stop(); void publisher?.stop(); },
        };
        currentSessionId = session_id;
        activeSessions.set(session_id, session);
      } catch (err) {
        void publisher?.stop();
        send(ws, { type: "error", message: `Failed to spawn ffmpeg: ${String(err)}` });
        return;
      }

      // Captured so the exit handlers can tell "my process died" from "a newer
      // connection already replaced me", and only clear the registry for the
      // former. The registry is keyed by session, not by socket, so a process
      // that outlives its WebSocket stays visible and reconnects wait for it.
      const spawned = session;

      spawned.onDrain(() => {
        if (ws.readyState === WebSocket.OPEN) ws.resume();
      });

      spawned.onError((err) => {
        console.error("[relay] ffmpeg spawn error:", err.message);
        send(ws, { type: "error", message: `ffmpeg spawn error: ${err.message}` });
        if (activeSessions.get(session_id) === spawned) activeSessions.delete(session_id);
        if (session === spawned) session = null;
        void publisher?.stop();
      });

      spawned.onExit((code, signal) => {
        if (process.env.NODE_ENV !== "production") console.log(`[relay] ffmpeg exited — code: ${code}, signal: ${signal}`);
        send(ws, { type: "stopped", code, signal });
        if (activeSessions.get(session_id) === spawned) activeSessions.delete(session_id);
        if (session === spawned) session = null;
        void publisher?.stop();
      });

      const timings = {
        auth_ms: authMs,
        database_ms: databaseMs,
        hls_setup_ms: hlsSetupMs,
        ffmpeg_spawn_ms: ffmpegSpawnMs,
        total_ms: startReceivedAt ? Date.now() - startReceivedAt : 0,
      };
      send(ws, { type: "started", hls_url: hlsUrl, timings });
      if (process.env.NODE_ENV !== "production") console.log("[relay-perf] start phases", { session_id, ...timings });
      if (process.env.NODE_ENV !== "production") console.log(`[relay] session ${session_id} started → ${rtmpTargets.length} destination(s), container: ${encoderParams.container}`);
    }

    // These teardown paths deliberately do NOT remove the registry entry: the
    // ffmpeg process can outlive its socket by seconds, and while it lives it
    // still holds the RTMP connection. Its own exit handler clears the entry,
    // so a reconnect arriving in the gap finds it and waits instead of racing
    // it for the stream key.
    if (msg.type === "stop") {
      void session?.stop();
      session = null;
      currentSessionId = null;
    }
  });

  ws.on("close", () => {
    void session?.stop();
    session = null;
    currentSessionId = null;
  });

  ws.on("error", (err) => {
    console.error("[relay] ws error:", err.message);
    void session?.stop();
    session = null;
    currentSessionId = null;
  });
});

function send(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

rtmpIngest = startRtmpIngest({ activeSessions, maxActiveStreams: MAX_ACTIVE_STREAMS });

httpServer.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") console.log(`[relay] listening on port ${PORT}`);
});
