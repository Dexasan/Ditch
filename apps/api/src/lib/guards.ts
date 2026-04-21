import type { FastifyReply } from "fastify";
import { supabaseAdmin } from "@ditch/db";

/**
 * Verifies that userId owns the destination (via destination → session → channel).
 * Returns the destination row on success, sends 403/404 and returns null on failure.
 */
export async function assertDestinationOwner(
  userId: string,
  destinationId: string,
  reply: FastifyReply
) {
  const client = supabaseAdmin!;

  const { data: destination, error } = await client
    .from("stream_destinations")
    .select("*, live_sessions!inner(channels!inner(owner_id))")
    .eq("id", destinationId)
    .single();

  if (error || !destination) {
    reply.status(404).send({ error: "Destination not found" });
    return null;
  }

  const session = destination.live_sessions as { channels: { owner_id: string } };
  if (session.channels.owner_id !== userId) {
    reply.status(403).send({ error: "Forbidden" });
    return null;
  }

  return destination;
}


/**
 * Verifies that userId is the owner of the channel that owns the session.
 * Returns the session row on success, sends a 403/404 reply and returns null
 * on failure — callers must check for null and return early.
 *
 * Usage:
 *   const session = await assertSessionOwner(request.user.id, params.id, reply)
 *   if (!session) return
 */
export async function assertSessionOwner(
  userId: string,
  sessionId: string,
  reply: FastifyReply
) {
  const client = supabaseAdmin!;

  const { data: session, error } = await client
    .from("live_sessions")
    .select("*, channels!inner(owner_id)")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    reply.status(404).send({ error: "Session not found" });
    return null;
  }

  // channels!inner join guarantees channels exists, but TS sees it as unknown shape
  const channel = session.channels as { owner_id: string };

  if (channel.owner_id !== userId) {
    reply.status(403).send({ error: "Forbidden" });
    return null;
  }

  return session;
}

/**
 * Looks up a participant and verifies the caller is either the session owner
 * (creator) or the participant themselves. Returns { participant, isCreator }
 * on success, sends 403/404 and returns null on failure.
 */
export async function assertParticipantAccess(
  userId: string,
  participantId: string,
  reply: FastifyReply
) {
  const client = supabaseAdmin!;

  const { data: participant, error } = await client
    .from("participants")
    .select("*, live_sessions!inner(channels!inner(owner_id))")
    .eq("id", participantId)
    .single();

  if (error || !participant) {
    reply.status(404).send({ error: "Participant not found" });
    return null;
  }

  const session = participant.live_sessions as { channels: { owner_id: string } };
  const isCreator = session.channels.owner_id === userId;
  const isSelf = participant.user_id === userId;

  if (!isCreator && !isSelf) {
    reply.status(403).send({ error: "Forbidden" });
    return null;
  }

  return { participant, isCreator };
}

/**
 * Verifies that userId is the owner of the given channel.
 * Returns the channel row on success, sends a 403/404 and returns null on
 * failure.
 */
export async function assertChannelOwner(
  userId: string,
  channelId: string,
  reply: FastifyReply
) {
  const client = supabaseAdmin!;

  const { data: channel, error } = await client
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .single();

  if (error || !channel) {
    reply.status(404).send({ error: "Channel not found" });
    return null;
  }

  if (channel.owner_id !== userId) {
    reply.status(403).send({ error: "Forbidden" });
    return null;
  }

  return channel;
}
