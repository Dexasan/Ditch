import type { FastifyInstance } from "fastify";
import type { ParticipantStatus } from "@ditch/types";
import type { Database } from "@ditch/db";
import { supabaseAdmin, verifyAccessToken, removeLiveKitParticipant } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import { assertSessionOwner, assertParticipantAccess } from "../lib/guards";
import { issueParticipantToken } from "../lib/participantToken";

type StreamPlatform = Database["public"]["Enums"]["stream_platform"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

function stripUserId(p: ParticipantRow) {
  const { user_id: _, ...pub } = p;
  return pub;
}

export async function participantRoutes(server: FastifyInstance) {
  /**
   * POST /participants
   *
   * A viewer requests to join a session as a participant.
   * Auth is optional — anonymous viewers are allowed (user_id will be null).
   * If an Authorization header is present and valid, user_id is attached.
   *
   * Body:   { session_id, display_name, platform_origin }
   * Return: 201 { participant }
   */
  server.post<{
    Body: {
      session_id: string;
      display_name: string;
      platform_origin: StreamPlatform;
    };
  }>(
    "/participants",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["session_id", "display_name", "platform_origin"],
          properties: {
            session_id: { type: "string", format: "uuid" },
            display_name: { type: "string", minLength: 1, maxLength: 64 },
            platform_origin: {
              type: "string",
              enum: ["twitch", "youtube", "tiktok", "kick", "ditch"],
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { session_id, display_name, platform_origin } = request.body;

      // Resolve optional user identity from Authorization header
      let userId: string | null = null;
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const user = await verifyAccessToken(token);
        if (!user) return reply.status(401).send({ error: "Authentication required" });
        userId = user.id;
      }

      // Verify the session exists and is joinable
      const { data: session, error: sessionError } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status")
        .eq("id", session_id)
        .single();

      if (sessionError || !session) {
        return reply.status(404).send({ error: "Session not found" });
      }

      if (session.status === "ended") {
        return reply.status(422).send({ error: "Session has ended" });
      }

      // Prevent authenticated users from submitting duplicate active requests
      if (userId) {
        const { data: existing } = await supabaseAdmin!
          .from("participants")
          .select("id")
          .eq("session_id", session_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          return reply.status(409).send({ error: "You already have a participant request for this session" });
        }
      }

      const { data: participant, error } = await supabaseAdmin!
        .from("participants")
        .insert({
          session_id,
          display_name,
          platform_origin,
          user_id: userId,
          status: "waiting",
        })
        .select()
        .single();

      if (error || !participant) {
        return reply.status(500).send({ error: "Failed to join session" });
      }

      // Anonymous guests have no auth.uid() to present when they later ask for
      // an RTC publish token, so hand them a credential scoped to this
      // participant row. Signed-in guests get one too: it keeps the client path
      // uniform and still works if their access token expires mid-session.
      return reply.status(201).send({
        participant,
        participant_token: issueParticipantToken(participant.id, session_id),
      });
    }
  );

  /**
   * GET /participants?session_id=
   *
   * Public — returns all non-removed participants for a session.
   * Used by the creator's control room and the public channel page.
   *
   * Return: 200 { participants }
   */
  server.get<{ Querystring: { session_id: string } }>(
    "/participants",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["session_id"],
          properties: {
            session_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { session_id } = request.query;

      let isOwner = false;
      if (request.headers.authorization?.startsWith("Bearer ")) {
        const user = await verifyAccessToken(request.headers.authorization.slice(7));
        const { data: session } = await supabaseAdmin!.from("live_sessions").select("channels!inner(owner_id)").eq("id", session_id).single();
        isOwner = !!user && (session?.channels as { owner_id: string } | null)?.owner_id === user.id;
      }
      const { data: participants, error } = await supabaseAdmin!
        .from("participants")
        .select("*")
        .eq("session_id", session_id)
        .in("status", isOwner ? ["waiting", "approved", "live"] : ["live"])
        .order("joined_at", { ascending: true })
        .limit(200);

      if (error) {
        return reply.status(500).send({ error: "Failed to fetch participants" });
      }

      return reply.status(200).send({ participants: (participants ?? []).map(stripUserId) });
    }
  );

  /**
   * PATCH /participants/:id
   *
   * Creator-only. Updates a participant's status and optionally assigns a slot.
   *
   * Valid transitions:
   *   waiting  → approved
   *   approved → live     (slot_index required)
   *   live     → removed
   *   waiting  → removed  (creator rejects the request)
   *   approved → removed
   *
   * Body:   { status: ParticipantStatus, slot_index?: number }
   * Return: 200 { participant }
   */
  server.patch<{
    Params: { id: string };
    Body: { status: ParticipantStatus; slot_index?: number };
  }>(
    "/participants/:id",
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["waiting", "approved", "live", "removed"],
            },
            slot_index: { type: "integer", minimum: 0, maximum: 3 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status: newStatus, slot_index } = request.body;
      const userId = request.user.id;

      // Fetch participant and verify caller is the session owner
      const { data: participant, error: fetchError } = await supabaseAdmin!
        .from("participants")
        .select("*, live_sessions!inner(id, channels!inner(owner_id))")
        .eq("id", id)
        .single();

      if (fetchError || !participant) {
        return reply.status(404).send({ error: "Participant not found" });
      }

      const session = participant.live_sessions as {
        id: string;
        channels: { owner_id: string };
      };

      if (session.channels.owner_id !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const currentStatus = participant.status as ParticipantStatus;

      const transitions: Record<ParticipantStatus, ParticipantStatus[]> = {
        waiting:  ["approved", "removed"],
        approved: ["live", "removed"],
        live:     ["removed"],
        removed:  [],
      };

      if (!transitions[currentStatus].includes(newStatus)) {
        return reply.status(422).send({
          error: `Invalid transition: ${currentStatus} → ${newStatus}`,
          allowed: transitions[currentStatus],
        });
      }

      if (newStatus === "live" && slot_index == null) {
        return reply.status(422).send({ error: "slot_index is required when setting status to live" });
      }

      const update: { status: ParticipantStatus; slot_index?: number | null } = {
        status: newStatus,
      };
      if (newStatus === "live") {
        update.slot_index = slot_index;
      } else if (newStatus === "removed") {
        update.slot_index = null;
      }

      const { data: updated, error } = await supabaseAdmin!
        .from("participants")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error || !updated) {
        return reply.status(500).send({ error: "Failed to update participant" });
      }

      if (newStatus === "removed") {
        try { await removeLiveKitParticipant(participant.session_id, participant.slot_index); }
        catch { request.log.error("LiveKit participant removal failed"); return reply.status(502).send({ error: "Participant access revoked, but media disconnect failed. End the session if they remain on screen." }); }
      }
      return reply.status(200).send({ participant: updated });
    }
  );

  /**
   * DELETE /participants/:id
   *
   * Removes a participant. Allowed for:
   *   - The session owner (creator kicking someone)
   *   - The participant themselves (leaving voluntarily)
   *
   * Sets status to "removed" rather than hard-deleting, to preserve history.
   *
   * Return: 200 { participant }
   */
  server.delete<{ Params: { id: string } }>(
    "/participants/:id",
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      const result = await assertParticipantAccess(userId, id, reply);
      if (!result) return;

      const { data: before } = await supabaseAdmin!.from("participants").select("session_id, slot_index").eq("id", id).single();
      const { data: participant, error } = await supabaseAdmin!
        .from("participants")
        .update({ status: "removed", slot_index: null })
        .eq("id", id)
        .select()
        .single();

      if (error || !participant) {
        return reply.status(500).send({ error: "Failed to remove participant" });
      }

      if (before) {
        try { await removeLiveKitParticipant(before.session_id, before.slot_index); }
        catch { request.log.error("LiveKit participant removal failed"); return reply.status(502).send({ error: "Participant access revoked, but media disconnect failed." }); }
      }
      return reply.status(200).send({ participant });
    }
  );
}
