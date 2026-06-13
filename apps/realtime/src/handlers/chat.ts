import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { supabaseAdmin } from "@ditch/db";
import type { ChatMessage } from "@ditch/types";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerChatHandlers(io: AppServer, socket: AppSocket) {
  /**
   * chat:message
   *
   * A viewer sends a chat message from any platform. The server persists it to
   * chat_messages, then broadcasts the normalized message to the whole room so
   * all viewers see a unified feed regardless of origin platform.
   *
   * Payload: { session_id, body, display_name, platform_origin }
   */
  socket.on("chat:message", async ({ session_id, body, display_name }) => {
    try {
      if (!socket.data.user_id) {
        socket.emit("chat:error", { code: "auth_required", message: "Sign in to chat" });
        return;
      }
      if (!body?.trim()) return;
      if (body.length > 500) return;

      // Authenticated users: use verified display name stored at connect time.
      // Anonymous users: use the client-provided name (unverifiable).
      const rawName = socket.data.display_name ?? display_name ?? "Viewer";
      const authorName = rawName.slice(0, 64);

      const { data: message, error } = await supabaseAdmin!
        .from("chat_messages")
        .insert({
          session_id,
          platform: "ditch",
          author_display_name: authorName,
          body: body.trim(),
        })
        .select()
        .single();

      if (error || !message) {
        return socket.emit("error", { message: "Failed to send message" });
      }

      io.to(session_id).emit("chat:message", { message: message as ChatMessage });
    } catch (err) {
      console.error("[realtime] chat:message failed:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });
}
