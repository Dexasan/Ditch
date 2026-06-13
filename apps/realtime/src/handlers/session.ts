import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { supabaseAdmin } from "@ditch/db";
import type { Participant, ChatMessage } from "@ditch/types";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerSessionHandlers(io: AppServer, socket: AppSocket) {
  /**
   * session:join
   *
   * Joins a Socket.io room keyed by session_id. Validates the session exists.
   * Responds with the current active (non-removed) participants via ack.
   */
  socket.on("session:join", async ({ session_id }, ack) => {
    try {
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status")
        .eq("id", session_id)
        .single();

      if (!session) {
        return ack("Session not found");
      }

      if (session.status === "ended") {
        return ack("Session has ended");
      }

      await socket.join(session_id);

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

      ack(null, {
        participants: (participants ?? []) as Participant[],
        recentMessages: (recentMessages ?? []) as ChatMessage[],
      });

      // Notify the rest of the room that someone joined
      socket.to(session_id).emit("session:state", {
        session_id,
        participants: (participants ?? []) as Participant[],
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
  });

  /**
   * disconnect
   *
   * Socket.io automatically removes the socket from all rooms on disconnect.
   * Logged here for observability.
   */
  socket.on("disconnect", () => {
    console.log(`[realtime] socket ${socket.id} disconnected`);
  });
}
