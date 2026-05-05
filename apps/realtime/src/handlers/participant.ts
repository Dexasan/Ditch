import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types.js";
import { supabaseAdmin } from "@ditch/db";
import type { Participant, ParticipantStatus } from "@ditch/types";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const VALID_TRANSITIONS: Record<ParticipantStatus, ParticipantStatus[]> = {
  waiting:  ["approved", "removed"],
  approved: ["live", "removed"],
  live:     ["removed"],
  removed:  [],
};

async function fetchActiveParticipants(session_id: string): Promise<Participant[]> {
  const { data } = await supabaseAdmin!
    .from("participants")
    .select("*")
    .eq("session_id", session_id)
    .neq("status", "removed")
    .order("joined_at", { ascending: true });
  return (data ?? []) as Participant[];
}

export function registerParticipantHandlers(io: AppServer, socket: AppSocket) {
  /**
   * participant:status_change
   *
   * Creator-only. Validates ownership, enforces status transitions, writes to
   * DB, then broadcasts the updated participant and full queue to the room.
   *
   * Payload: { session_id, participant_id, status, slot_index? }
   */
  socket.on("participant:status_change", async ({ session_id, participant_id, status: newStatus, slot_index }) => {
    const userId = socket.data.user_id;

    if (!userId) {
      return socket.emit("error", { message: "Authentication required" });
    }

    // Verify caller owns the session (via channel ownership)
    const { data: session } = await supabaseAdmin!
      .from("live_sessions")
      .select("id, channels!inner(owner_id)")
      .eq("id", session_id)
      .single();

    if (!session) {
      return socket.emit("error", { message: "Session not found" });
    }

    const channel = session.channels as { owner_id: string };
    if (channel.owner_id !== userId) {
      return socket.emit("error", { message: "Forbidden" });
    }

    // Fetch the participant and validate the transition
    const { data: participant } = await supabaseAdmin!
      .from("participants")
      .select("*")
      .eq("id", participant_id)
      .eq("session_id", session_id)
      .single();

    if (!participant) {
      return socket.emit("error", { message: "Participant not found" });
    }

    const currentStatus = participant.status as ParticipantStatus;
    if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      return socket.emit("error", {
        message: `Invalid transition: ${currentStatus} → ${newStatus}`,
      });
    }

    if (newStatus === "live" && slot_index == null) {
      return socket.emit("error", { message: "slot_index required when setting status to live" });
    }

    const update: { status: ParticipantStatus; slot_index?: number | null } = { status: newStatus };
    if (newStatus === "live")    update.slot_index = slot_index;
    if (newStatus === "removed") update.slot_index = null;

    const { data: updated, error } = await supabaseAdmin!
      .from("participants")
      .update(update)
      .eq("id", participant_id)
      .select()
      .single();

    if (error || !updated) {
      return socket.emit("error", { message: "Failed to update participant" });
    }

    // Broadcast the individual change and the refreshed queue to the whole room
    const updatedParticipant = updated as Participant;
    io.to(session_id).emit("participant:status_change", { participant: updatedParticipant });

    const participants = await fetchActiveParticipants(session_id);
    io.to(session_id).emit("participant:queue_update", { session_id, participants });
  });

  /**
   * participant:queue_update
   *
   * Creator-only. Fetches the current participant queue for a session and emits
   * it back to the requesting socket. Requires the caller to be the session owner.
   */
  socket.on("participant:queue_update", async ({ session_id }) => {
    const userId = socket.data.user_id;

    if (!userId) {
      return socket.emit("error", { message: "Authentication required" });
    }

    const { data: session } = await supabaseAdmin!
      .from("live_sessions")
      .select("channels!inner(owner_id)")
      .eq("id", session_id)
      .single();

    const channel = session?.channels as { owner_id: string } | null;
    if (!channel || channel.owner_id !== userId) {
      return socket.emit("error", { message: "Forbidden" });
    }

    const participants = await fetchActiveParticipants(session_id);
    socket.emit("participant:queue_update", { session_id, participants });
  });
}
