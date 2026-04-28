import { WebSocketServer, WebSocket } from "ws";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { supabaseAdmin } from "@ditch/db";
import { validateEnv } from "./lib/env.js";
import { spawnFfmpeg, type FfmpegSession } from "./lib/ffmpeg.js";

validateEnv();

const PORT = Number(process.env.RELAY_PORT ?? process.env.PORT) || 3003;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim());
  return explicit.includes(origin) || origin.endsWith(".vercel.app");
}

// HTTP server handles Railway health checks; WebSocket server piggybacks on it
const httpServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: ({ origin }: { origin: string }) => isOriginAllowed(origin),
});

wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
  let session: FfmpegSession | null = null;

  ws.on("message", async (data, isBinary) => {
    // Binary frame: raw video chunk — pipe straight to ffmpeg stdin
    if (isBinary) {
      session?.write(data as Buffer);
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse((data as Buffer).toString());
    } catch {
      return;
    }

    if (msg.type === "start") {
      const { session_id, token } = msg as { session_id: string; token: string };

      // 1. Validate JWT
      const { data: authData, error: authError } = await supabaseAdmin!.auth.getUser(token);
      if (authError || !authData.user) {
        send(ws, { type: "error", message: "Unauthorized" });
        return;
      }
      const userId = authData.user.id;

      // 2. Verify the user owns the session
      const { data: sessionRow } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();

      type SessionWithChannel = { id: string; channels: { owner_id: string } };
      const row = sessionRow as SessionWithChannel | null;

      if (!row || row.channels.owner_id !== userId) {
        send(ws, { type: "error", message: "Forbidden" });
        return;
      }

      // 3. Fetch RTMP destinations (service role bypasses RLS — credentials never reach browser)
      const { data: destinations } = await supabaseAdmin!
        .from("stream_destinations")
        .select("rtmp_url, stream_key")
        .eq("session_id", session_id);

      if (!destinations?.length) {
        send(ws, { type: "error", message: "No active destinations configured for this session" });
        return;
      }

      const rtmpTargets = destinations.map((d) => `${d.rtmp_url}/${d.stream_key}`);

      // 4. Spawn ffmpeg
      try {
        session = spawnFfmpeg(rtmpTargets, session_id);
      } catch (err) {
        send(ws, { type: "error", message: `Failed to spawn ffmpeg: ${String(err)}` });
        return;
      }

      session.onError((err) => {
        console.error("[relay] ffmpeg spawn error:", err.message);
        send(ws, { type: "error", message: `ffmpeg spawn error: ${err.message}` });
        session = null;
      });

      session.onExit((code, signal) => {
        console.log(`[relay] ffmpeg exited — code: ${code}, signal: ${signal}`);
        send(ws, { type: "stopped", code, signal });
        session = null;
      });

      send(ws, { type: "started" });
      console.log(`[relay] session ${session_id} started → ${rtmpTargets.length} destination(s)`);
    }

    if (msg.type === "stop") {
      session?.stop();
      session = null;
    }
  });

  ws.on("close", () => {
    session?.stop();
    session = null;
  });

  ws.on("error", (err) => {
    console.error("[relay] ws error:", err.message);
    session?.stop();
    session = null;
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
