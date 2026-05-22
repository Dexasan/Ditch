import type { Participant, ChatMessage, ParticipantStatus, StreamPlatform } from "@ditch/types";

// ── Client → Server ───────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  "session:join": (
    data: { session_id: string },
    ack: (err: string | null, state?: { participants: Participant[]; recentMessages: ChatMessage[] }) => void
  ) => void;

  "session:leave": (data: { session_id: string }) => void;

  "participant:status_change": (data: {
    session_id: string;
    participant_id: string;
    status: ParticipantStatus;
    slot_index?: number;
  }) => void;

  "participant:queue_update": (data: { session_id: string }) => void;

  "participant:notify_new": (data: { session_id: string }) => void;

  "chat:message": (data: {
    session_id: string;
    body: string;
    display_name: string;
    platform_origin: StreamPlatform;
  }) => void;
}

// ── Server → Client ───────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  "session:state": (data: { session_id: string; participants: Participant[] }) => void;
  "participant:status_change": (data: { participant: Participant }) => void;
  "participant:queue_update": (data: { session_id: string; participants: Participant[] }) => void;
  "chat:message": (data: { message: ChatMessage }) => void;
  "chat:error": (data: { code: string; message: string }) => void;
  "error": (data: { message: string }) => void;
}

// ── Per-socket data ───────────────────────────────────────────────────────────

export interface SocketData {
  user_id: string | null;
  display_name: string | null;
}
