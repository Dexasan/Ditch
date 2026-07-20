import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { verifyAccessToken } from "@ditch/db";

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

  // verifyAccessToken checks the JWT signature locally when
  // SUPABASE_JWT_SECRET is set, so a Supabase Auth outage no longer locks
  // everyone out of the realtime channel. It swallows its own failures, but
  // keep the guard so nothing can escape this async middleware and become an
  // unhandled rejection that crashes the whole realtime process.
  try {
    const user = await verifyAccessToken(token);

    if (!user) {
      return next(new Error("Invalid or expired token"));
    }

    socket.data.user_id = user.id;
    socket.data.display_name = user.display_name;
    next();
  } catch (err) {
    console.error("[realtime] token verification failed:", err);
    next(new Error("Authentication unavailable"));
  }
}
