import { WebSocketServer, WebSocket } from "ws";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { supabaseAdmin, verifyAccessToken } from "@ditch/db";
import { validateEnv } from "./lib/env.js";
import { spawnFfmpeg, sanitizeEncoderParams, type FfmpegSession } from "./lib/ffmpeg.js";
import { createHlsPublisher, isHlsConfigured, type HlsPublisher } from "./lib/hls.js";

validateEnv();

const PORT = Number(process.env.RELAY_PORT ?? process.env.PORT) || 3003;
const MAX_ACTIVE_STREAMS = Math.max(1, Number(process.env.MAX_ACTIVE_STREAMS) || 4);

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim());
  if (explicit.includes(origin)) return true;
  const teamSlug = process.env.VERCEL_TEAM_SLUG;
  if (teamSlug) {
    return new RegExp(`^https://[\\w-]+-${teamSlug}\\.vercel\\.app$`).test(origin);
  }
  return false;
}

// HTTP server handles Railway health checks; WebSocket server piggybacks on it
const httpServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({
    status: "ok",
    active_streams: activeSessions.size,
    max_active_streams: MAX_ACTIVE_STREAMS,
    hls_enabled: isHlsConfigured(),
    uptime_seconds: Math.round(process.uptime()),
  }));
});

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: ({ origin }: { origin: string }) => isOriginAllowed(origin),
});

// Keyed by session_id. Ensures at most one ffmpeg process per session across
// all WebSocket connections — kills any stale process before spawning a new one.
const activeSessions = new Map<string, FfmpegSession>();

wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
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
          console.log("[relay-perf] first media received", {
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

    if (msg.type === "start") {
      startReceivedAt = Date.now();
      firstMediaReceived = false;
      const { session_id, token } = msg as { session_id: string; token: string };
      const encoderParams = sanitizeEncoderParams(msg);

      // 1. Validate JWT - local signature check when SUPABASE_JWT_SECRET is
      // set, so stream start neither pays an Auth round trip nor breaks when
      // Supabase Auth is unreachable.
      const authStartedAt = Date.now();
      const authUser = await verifyAccessToken(token);
      const authMs = Date.now() - authStartedAt;
      if (!authUser) {
        send(ws, { type: "error", message: "Unauthorized", retryable: false });
        return;
      }
      const userId = authUser.id;

      // 2 + 3. Verify ownership and fetch destinations in parallel
      type SessionWithChannel = { id: string; channels: { owner_id: string } };
      const databaseStartedAt = Date.now();
      const [{ data: sessionRow }, { data: destinations }] = await Promise.all([
        supabaseAdmin!
          .from("live_sessions")
          .select("id, channels!inner(owner_id)")
          .eq("id", session_id)
          .single(),
        supabaseAdmin!
          .from("stream_destinations")
          .select("rtmp_url, stream_key")
          .eq("session_id", session_id),
      ]);
      const databaseMs = Date.now() - databaseStartedAt;

      const row = sessionRow as SessionWithChannel | null;

      if (!row || row.channels.owner_id !== userId) {
        send(ws, { type: "error", message: "Forbidden", retryable: false });
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
        console.log(`[relay] session ${session_id} — killing stale process before respawn`);
        stale.stop();
        activeSessions.delete(session_id);
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
          stop: () => { ffmpeg.stop(); void publisher?.stop(); },
        };
        currentSessionId = session_id;
        activeSessions.set(session_id, session);
      } catch (err) {
        void publisher?.stop();
        send(ws, { type: "error", message: `Failed to spawn ffmpeg: ${String(err)}` });
        return;
      }

      session.onDrain(() => {
        if (ws.readyState === WebSocket.OPEN) ws.resume();
      });

      session.onError((err) => {
        console.error("[relay] ffmpeg spawn error:", err.message);
        send(ws, { type: "error", message: `ffmpeg spawn error: ${err.message}` });
        if (currentSessionId) activeSessions.delete(currentSessionId);
        session = null;
        void publisher?.stop();
      });

      session.onExit((code, signal) => {
        console.log(`[relay] ffmpeg exited — code: ${code}, signal: ${signal}`);
        send(ws, { type: "stopped", code, signal });
        if (currentSessionId) activeSessions.delete(currentSessionId);
        session = null;
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
      console.log("[relay-perf] start phases", { session_id, ...timings });
      console.log(`[relay] session ${session_id} started → ${rtmpTargets.length} destination(s)`);
    }

    if (msg.type === "stop") {
      session?.stop();
      if (currentSessionId) activeSessions.delete(currentSessionId);
      session = null;
      currentSessionId = null;
    }
  });

  ws.on("close", () => {
    session?.stop();
    if (currentSessionId) activeSessions.delete(currentSessionId);
    session = null;
    currentSessionId = null;
  });

  ws.on("error", (err) => {
    console.error("[relay] ws error:", err.message);
    session?.stop();
    if (currentSessionId) activeSessions.delete(currentSessionId);
    session = null;
    currentSessionId = null;
  });
});

function send(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

httpServer.listen(PORT, () => {
  console.log(`[relay] listening on port ${PORT}`);
});
