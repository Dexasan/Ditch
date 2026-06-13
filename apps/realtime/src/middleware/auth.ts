import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { supabaseAdmin } from "@ditch/db";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Socket.io connection middleware — validates the Supabase JWT from
 * socket.handshake.auth.token if present. Anonymous connections are allowed;
 * user_id will be null for unauthenticated sockets.
 */
export async function authMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void
) {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    socket.data.user_id = null;
    socket.data.display_name = null;
    return next();
  }

  if (!supabaseAdmin) {
    return next(new Error("Server misconfiguration"));
  }

  // getUser() is a network call to Supabase Auth — if it rejects (transient
  // outage / timeout) the rejection must not escape this async middleware, or it
  // becomes an unhandled rejection that crashes the whole realtime process.
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return next(new Error("Invalid or expired token"));
    }

    socket.data.user_id = data.user.id;
    socket.data.display_name =
      (data.user.user_metadata?.display_name as string | undefined) ??
      data.user.email?.split("@")[0] ??
      null;
    next();
  } catch (err) {
    console.error("[realtime] auth getUser failed:", err);
    next(new Error("Authentication unavailable"));
  }
}
