import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { registerSessionHandlers } from "./session.js";
import { registerParticipantHandlers } from "./participant.js";
import { registerChatHandlers } from "./chat.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerHandlers(io: AppServer, socket: AppSocket) {
  registerSessionHandlers(io, socket);
  registerParticipantHandlers(io, socket);
  registerChatHandlers(io, socket);
}
