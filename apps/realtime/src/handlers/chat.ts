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
  socket.on("chat:message", async ({ session_id, body, display_name, platform_origin }) => {
    if (!body?.trim()) return;

    const { data: message, error } = await supabaseAdmin!
      .from("chat_messages")
      .insert({
        session_id,
        platform: platform_origin,
        author_display_name: display_name,
        body: body.trim(),
      })
      .select()
      .single();

    if (error || !message) {
      return socket.emit("error", { message: "Failed to send message" });
    }

    io.to(session_id).emit("chat:message", { message: message as ChatMessage });
  });
}
