import type { FastifyInstance } from "fastify";
import type { SessionSource, SessionStatus } from "@ditch/types";
import type { Database } from "@ditch/db";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import { assertSessionOwner, assertChannelOwner } from "../lib/guards";

type SessionUpdate = Database["public"]["Tables"]["live_sessions"]["Update"];

export async function sessionRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>(
    "/sessions/:id",
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
      const session = await assertSessionOwner(request.user.id, request.params.id, reply);
      if (!session) return;
      return reply.send({ session });
    },
  );
  /**
   * POST /sessions
   *
   * Starts a new session on a channel the authenticated user owns.
   * Rejects if there is already an active (non-ended) session on that channel.
   *
   * Body:   { channel_id }
   * Return: 201 { session: LiveSession }
   */
  server.post<{ Body: { channel_id: string } }>(
    "/sessions",
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: "object",
          required: ["channel_id"],
          properties: {
            channel_id: { type: "string", format: "uuid" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { channel_id } = request.body;
      const userId = request.user.id;

      // Verify ownership
      const channel = await assertChannelOwner(userId, channel_id, reply);
      if (!channel) return;

      // Block if an active session already exists on this channel
      const { data: existing } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status")
        .eq("channel_id", channel_id)
        .neq("status", "ended")
        .maybeSingle();

      if (existing) {
        return reply.status(409).send({
          error: "An active session already exists on this channel",
          session_id: existing.id,
        });
      }

      const { data: session, error } = await supabaseAdmin!
        .from("live_sessions")
        .insert({ channel_id, status: "idle" })
        .select()
        .single();

      if (error || !session) {
        return reply.status(500).send({ error: "Failed to create session" });
      }

      return reply.status(201).send({ session });
    }
  );

  /**
   * PATCH /sessions/:id
   *
   * Updates session state. Enforces valid status transitions and sets
   * started_at / ended_at timestamps automatically.
   *
   * Valid transitions:
   *   idle    → live    (stream goes live, started_at set)
   *   live    → ending  (graceful wind-down)
   *   ending  → ended   (fully done, ended_at set)
   *   any     → ended   (force-end from any state)
   *
   * Body:   { status: SessionStatus }
   * Return: 200 { session: LiveSession }
   */
  server.patch<{ Params: { id: string }; Body: { status: SessionStatus; source_type?: SessionSource } }>(
    "/sessions/:id",
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
            status: { type: "string", enum: ["idle", "live", "ending", "ended"] },
            source_type: { type: "string", enum: ["browser", "rtmp"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status: newStatus, source_type } = request.body;
      const userId = request.user.id;

      const existing = await assertSessionOwner(userId, id, reply);
      if (!existing) return;

      // Enforce valid transitions
      const transitions: Record<SessionStatus, SessionStatus[]> = {
        idle:   ["live", "ended"],
        live:   ["ending", "ended"],
        ending: ["ended"],
        ended:  [],
      };

      const currentStatus = existing.status as SessionStatus;

      if (!transitions[currentStatus].includes(newStatus)) {
        return reply.status(422).send({
          error: `Invalid transition: ${currentStatus} → ${newStatus}`,
          allowed: transitions[currentStatus],
        });
      }

      // Build the update payload — set timestamps on key transitions
      const update: SessionUpdate = { status: newStatus };
      if (source_type) {
        if (currentStatus !== "idle" || newStatus !== "live") {
          return reply.status(422).send({
            error: "Source type can only be selected when an idle session goes live",
          });
        }
        update.source_type = source_type;
      }
      if (newStatus === "live" && !existing.started_at) {
        update.started_at = new Date().toISOString();
      }
      if (newStatus === "ended" && !existing.ended_at) {
        update.ended_at = new Date().toISOString();
      }

      const { data: session, error } = await supabaseAdmin!
        .from("live_sessions")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error || !session) {
        return reply.status(500).send({ error: "Failed to update session" });
      }

      return reply.status(200).send({ session });
    }
  );

  /**
   * DELETE /sessions/:id
   *
   * Force-ends a session from any state. Sets status to "ended" and records
   * ended_at. Idempotent — safe to call on an already-ended session.
   *
   * Return: 200 { session: LiveSession }
   */
  server.delete<{ Params: { id: string } }>(
    "/sessions/:id",
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

      const existing = await assertSessionOwner(userId, id, reply);
      if (!existing) return;

      const update: SessionUpdate = { status: "ended" };
      if (!existing.ended_at) {
        update.ended_at = new Date().toISOString();
      }

      const { data: session, error } = await supabaseAdmin!
        .from("live_sessions")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error || !session) {
        return reply.status(500).send({ error: "Failed to end session" });
      }

      return reply.status(200).send({ session });
    }
  );
}
