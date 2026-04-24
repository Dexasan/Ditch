// Core domain types for DITCH
// Keep these in sync with the Supabase schema in packages/db

// ─── Enums ────────────────────────────────────────────────────────────────────

export type StreamPlatform =
  | "twitch"
  | "youtube"
  | "tiktok"
  | "kick"
  | "ditch";

export type SessionStatus = "idle" | "live" | "ending" | "ended";

export type ParticipantStatus = "waiting" | "approved" | "live" | "removed";

export type DestinationStatus = "idle" | "connecting" | "live" | "error" | "stopped";

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  owner_id: string;
  slug: string;           // unique URL slug, e.g. ditch.tv/c/creativechris
  display_name: string;
  description: string | null;
  created_at: string;
}

export interface LiveSession {
  id: string;
  channel_id: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// A platform the creator is simultaneously pushing their stream to.
// RTMP credentials are stored server-side only — never sent to the browser.
export interface StreamDestination {
  id: string;
  session_id: string;
  platform: StreamPlatform;
  status: DestinationStatus;
  created_at: string;
}

// A viewer who has requested (or been approved) to appear on stream.
export interface Participant {
  id: string;
  session_id: string;
  user_id: string | null;       // null if anonymous
  display_name: string;
  platform_origin: StreamPlatform; // which platform they came from
  status: ParticipantStatus;
  slot_index: number | null;    // on-screen slot when status === "live"
  joined_at: string;
}

// A single chat message, originating from any connected platform.
export interface ChatMessage {
  id: string;
  session_id: string;
  platform: StreamPlatform;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  timestamp: string;
}

// ─── Socket event payloads ────────────────────────────────────────────────────

export interface JoinChannelPayload {
  channel_slug: string;
}

export interface ChatMessagePayload {
  session_id: string;
  body: string;
}

export interface ParticipantRequestPayload {
  session_id: string;
  display_name: string;
  platform_origin: StreamPlatform;
}

export interface ParticipantActionPayload {
  session_id: string;
  participant_id: string;
  action: "approve" | "remove";
  slot_index?: number; // required when action === "approve"
}

export interface StreamUpdatePayload {
  session_id: string;
  status: SessionStatus;
  participant_slots: Participant[]; // only participants with status === "live"
}
