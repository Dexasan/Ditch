import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { supabaseAdmin, verifyParticipantToken } from "@ditch/db";
import type { Participant, ChatMessage } from "@ditch/types";
import { startIngest, stopIngest } from "../ingest/manager.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerSessionHandlers(io: AppServer, socket: AppSocket) {
  /**
   * session:join
   *
   * Joins a Socket.io room keyed by session_id. Validates the session exists.
   * Responds with the current active (non-removed) participants via ack.
   */
  socket.on("session:join", async ({ session_id, participant_token }, ack) => {
    try {
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();

      if (!session) {
        return ack("Session not found");
      }

      if (session.status === "ended") {
        return ack("Session has ended");
      }

      const owner = (session.channels as { owner_id: string }).owner_id === socket.data.user_id;
      if (owner) await socket.join(`host:${session_id}`);
      const guestId = typeof participant_token === "string" ? verifyParticipantToken(participant_token, session_id) : null;
      // A session is a public audience room; private rooms are never client-chosen.
      await socket.join(session_id);

      // Start external chat ingestion (Twitch/YouTube) for this live session.
      // Idempotent and fire-and-forget — failures here must not block the join.
      // A periodic sweep also starts ingestion, covering the case where the room
      // is joined before destinations are applied.
      void startIngest(session_id);

      const [{ data: participants }, { data: recentMessages }] = await Promise.all([
        supabaseAdmin!
          .from("participants")
          .select("*")
          .eq("session_id", session_id)
          .neq("status", "removed")
          .order("joined_at", { ascending: true }),
        supabaseAdmin!
          .from("chat_messages")
          .select("*")
          .eq("session_id", session_id)
          .order("timestamp", { ascending: true })
          .limit(50),
      ]);

      const rows = (participants ?? []) as Participant[];
      for (const p of rows) {
        if (p.id === guestId || (socket.data.user_id && p.user_id === socket.data.user_id)) await socket.join(`participant:${p.id}`);
      }
      const visible = rows.filter(p => owner || p.status === "live" || p.id === guestId || (!!socket.data.user_id && p.user_id === socket.data.user_id))
        .map(p => ({ ...p, user_id: null }));
      ack(null, {
        participants: visible,
        recentMessages: (recentMessages ?? []) as ChatMessage[],
      });

    } catch (err) {
      // Always resolve the ack — otherwise the viewer hangs on a spinner forever.
      console.error("[realtime] session:join failed:", err);
      ack("Could not join right now — please retry");
    }
  });

  /**
   * session:leave
   *
   * Leaves a session room. No broadcast needed — Socket.io handles cleanup.
   */
  socket.on("session:leave", ({ session_id }) => {
    socket.leave(session_id);
    socket.leave(`host:${session_id}`);
    for (const room of socket.rooms) if (room.startsWith("participant:")) socket.leave(room);
  });

  /**
   * session:end
   *
   * Creator-only. Emitted by the creator when they end the broadcast. Verifies
   * channel ownership, then tells everyone in the room the session ended so
   * viewers stop watching instead of hanging on a frozen "live" stream.
   */
  socket.on("session:end", async ({ session_id }) => {
    try {
      const userId = socket.data.user_id;
      if (!userId) return;

      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();

      if (!session) return;

      const rawChannel = session.channels as { owner_id: string } | { owner_id: string }[];
      const channel = Array.isArray(rawChannel) ? rawChannel[0] : rawChannel;
      if (channel?.owner_id !== userId) return;

      stopIngest(session_id);
      io.to(session_id).emit("session:ended", { session_id });
    } catch (err) {
      console.error("[realtime] session:end failed:", err);
    }
  });

  /**
   * disconnect
   *
   * Socket.io automatically removes the socket from all rooms on disconnect.
   * Logged here for observability.
   */
  socket.on("disconnect", () => {
    if (process.env.NODE_ENV !== "production") console.log(`[realtime] socket ${socket.id} disconnected`);
  });
}
