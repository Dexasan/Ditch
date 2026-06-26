import type { Server } from "socket.io";
import { supabaseAdmin } from "@ditch/db";
import type { ChatMessage } from "@ditch/types";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import type { Ingestor } from "./types.js";
import { startTwitch } from "./twitch.js";
import { startYouTube } from "./youtube.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// session_id → its running connectors. Presence of a key (even an empty array)
// means "ingestion already set up for this session" so starts are idempotent.
const active = new Map<string, Ingestor[]>();

// Persist an ingested message and broadcast it to the session room so every
// viewer sees the unified feed. Mirrors the shape of native chat:message.
async function emitMessage(
  io: AppServer,
  sessionId: string,
  platform: "twitch" | "youtube",
  author: string,
  body: string,
) {
  const text = body.trim();
  if (!text) return;
  try {
    const { data: message, error } = await supabaseAdmin!
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        platform,
        author_display_name: author.slice(0, 64),
        body: text.slice(0, 500),
      })
      .select()
      .single();

    if (error || !message) return;
    io.to(sessionId).emit("chat:message", { message: message as ChatMessage });
  } catch (err) {
    console.error("[ingest] emit failed:", err);
  }
}

/**
 * Ensures chat ingestion is running for a live session. Idempotent — safe to
 * call on every session:join. Reads the session's external destinations and
 * starts a connector for each that has a channel reference.
 */
export async function startIngest(io: AppServer, sessionId: string): Promise<void> {
  if (active.has(sessionId)) return;
  active.set(sessionId, []); // reserve immediately to avoid concurrent double-starts

  const { data: dests } = await supabaseAdmin!
    .from("stream_destinations")
    .select("platform, channel_ref")
    .eq("session_id", sessionId);

  const connectors: Ingestor[] = [];
  for (const d of dests ?? []) {
    if (!d.channel_ref) continue;
    if (d.platform === "twitch") {
      connectors.push(startTwitch(d.channel_ref, (a, b) => emitMessage(io, sessionId, "twitch", a, b)));
    } else if (d.platform === "youtube") {
      connectors.push(startYouTube(d.channel_ref, (a, b) => emitMessage(io, sessionId, "youtube", a, b)));
    }
  }

  active.set(sessionId, connectors);
  if (connectors.length) {
    console.log(`[ingest] session ${sessionId}: ${connectors.length} connector(s) running`);
  }
}

/** Tears down all connectors for a session. Idempotent. */
export function stopIngest(sessionId: string): void {
  const connectors = active.get(sessionId);
  if (!connectors) return;
  for (const c of connectors) {
    try {
      c.stop();
    } catch {
      // ignore teardown errors
    }
  }
  active.delete(sessionId);
  console.log(`[ingest] session ${sessionId}: ingestion stopped`);
}

// Safety sweep: a creator who closes their tab without ending cleanly leaves
// connectors running. Every 60s, drop ingestion for any session that the DB no
// longer reports as live.
const SWEEP_MS = 60000;
setInterval(async () => {
  if (active.size === 0) return;
  for (const sessionId of [...active.keys()]) {
    try {
      const { data } = await supabaseAdmin!
        .from("live_sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      if (!data || data.status === "ended") stopIngest(sessionId);
    } catch {
      // leave it running; try again next sweep
    }
  }
}, SWEEP_MS).unref();
