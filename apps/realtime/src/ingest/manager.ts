import type { Server } from "socket.io";
import { supabaseAdmin } from "@ditch/db";
import type { ChatMessage } from "@ditch/types";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import type { Ingestor } from "./types.js";
import { startTwitch } from "./twitch.js";
import { startYouTube } from "./youtube.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// session_id → its running connectors. Presence of a key means ingestion is
// live for that session. We intentionally do NOT add a key when a session has
// no external destinations yet, so a later attempt can pick them up once the
// creator goes live (the room is often joined before destinations are applied).
const active = new Map<string, Ingestor[]>();
// Guards against two concurrent starts racing between the await points.
const starting = new Set<string>();

// Set once at boot so the sweep and connectors can broadcast without threading
// `io` through every call site.
let io: AppServer | null = null;

// Persist an ingested message and broadcast it to the session room so every
// viewer sees the unified feed. Mirrors the shape of native chat:message.
async function emitMessage(
  sessionId: string,
  platform: "twitch" | "youtube",
  author: string,
  body: string,
) {
  const text = body.trim();
  if (!text || !io) return;
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
 * call repeatedly (on every session:join and on every sweep). If the session
 * has no external destinations with a channel reference yet, it returns without
 * claiming the session, so a later call can start it once the creator goes live.
 */
export async function startIngest(sessionId: string): Promise<void> {
  if (!io || active.has(sessionId) || starting.has(sessionId)) return;
  starting.add(sessionId);
  try {
    const { data: dests } = await supabaseAdmin!
      .from("stream_destinations")
      .select("platform, channel_ref")
      .eq("session_id", sessionId);

    const externals = (dests ?? []).filter(
      (d) => d.channel_ref && (d.platform === "twitch" || d.platform === "youtube"),
    );
    // Nothing to read yet. Don't claim the session — a later attempt will retry
    // once destinations are applied.
    if (externals.length === 0) return;
    if (active.has(sessionId)) return; // re-check after the await

    const connectors: Ingestor[] = externals.map((d) =>
      d.platform === "twitch"
        ? startTwitch(d.channel_ref!, (a, b) => emitMessage(sessionId, "twitch", a, b))
        : startYouTube(d.channel_ref!, (a, b) => emitMessage(sessionId, "youtube", a, b)),
    );

    active.set(sessionId, connectors);
    console.log(`[ingest] session ${sessionId}: ${connectors.length} connector(s) running`);
  } catch (err) {
    console.error("[ingest] startIngest failed:", err);
  } finally {
    starting.delete(sessionId);
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

// Periodic reconciler. Handles the common race where the creator opens the
// control room (joining the session) BEFORE going live, then attaches
// destinations. It also cleans up sessions that ended without a clean stop.
const SWEEP_MS = 15000;

async function sweep() {
  try {
    // 1. Start ingestion for any live session not already reading. startIngest
    //    is a no-op when a session has no external destinations, so this is cheap.
    const { data: liveSessions } = await supabaseAdmin!
      .from("live_sessions")
      .select("id")
      .eq("status", "live");
    for (const s of liveSessions ?? []) {
      if (!active.has(s.id)) void startIngest(s.id);
    }

    // 2. Stop ingestion for sessions we're reading that are no longer live.
    for (const sessionId of [...active.keys()]) {
      const { data } = await supabaseAdmin!
        .from("live_sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      if (!data || data.status === "ended") stopIngest(sessionId);
    }
  } catch (err) {
    console.error("[ingest] sweep failed:", err);
  }
}

/** Wires the manager to the Socket.io server and starts the reconcile loop. */
export function initIngest(server: AppServer): void {
  io = server;
  setInterval(sweep, SWEEP_MS).unref();
}
