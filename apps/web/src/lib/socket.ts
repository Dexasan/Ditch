import { io, type Socket } from "socket.io-client";
import type { Participant, ChatMessage } from "@ditch/types";

// Typed ack for session:join
export type SessionJoinAck = (
  err: string | null,
  state?: { participants: Participant[]; recentMessages: ChatMessage[] }
) => void;

// Keep one socket per (url + token) pair to avoid duplicate connections
// when React strict-mode double-invokes effects in development.
let _socket: Socket | null = null;
let _socketKey = "";

export function getSocket(token?: string | null): Socket {
  const key = `${process.env.NEXT_PUBLIC_REALTIME_URL}|${token ?? ""}`;

  if (_socket && _socketKey === key) return _socket;

  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  _socket = io(process.env.NEXT_PUBLIC_REALTIME_URL!, {
    auth: token ? { token } : {},
    autoConnect: false,
  });

  _socketKey = key;
  return _socket;
}
