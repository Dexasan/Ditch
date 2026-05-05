import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

export async function channelRoutes(server: FastifyInstance) {
  /**
   * POST /channels
   *
   * Creates a new channel. The authenticated user becomes the owner.
   * Rejects if the slug is already taken.
   *
   * Body:   { slug, display_name, description? }
   * Return: 201 { channel }
   */
  server.post<{
    Body: { slug: string; display_name: string; description?: string };
  }>(
    "/channels",
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: "object",
          required: ["slug", "display_name"],
          properties: {
            slug:         { type: "string", minLength: 2, maxLength: 40, pattern: "^[a-z0-9-]+$" },
            display_name: { type: "string", minLength: 1, maxLength: 64 },
            description:  { type: "string", maxLength: 280 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { slug, display_name, description } = request.body;
      const owner_id = request.user.id;

      const { data: channel, error } = await supabaseAdmin!
        .from("channels")
        .insert({ owner_id, slug, display_name, description })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          // Distinguish slug conflict from owner_id conflict (one channel per user)
          const isOwnerConflict = error.message.includes("channels_owner_id_unique");
          if (isOwnerConflict) {
            return reply.status(409).send({
              error: "You already have a channel",
              code: "CHANNEL_EXISTS",
            });
          }
          return reply.status(409).send({ error: `Slug "${slug}" is already taken` });
        }
        return reply.status(500).send({ error: "Failed to create channel" });
      }

      return reply.status(201).send({ channel });
    }
  );

  /**
   * GET /channels/mine
   *
   * Returns the authenticated user's channel, or null if they haven't
   * created one yet. Used by the onboarding flow and dashboard to decide
   * whether to show the channel creation form or go straight to the control room.
   *
   * Return: 200 { channel: Channel | null }
   */
  server.get(
    "/channels/mine",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: channel } = await supabaseAdmin!
        .from("channels")
        .select("*")
        .eq("owner_id", request.user.id)
        .maybeSingle();

      return reply.status(200).send({ channel: channel ?? null });
    }
  );

  /**
   * GET /channels/:slug
   *
   * Public — no auth required. Returns the channel and its current active
   * session (any session not yet ended), or null if the channel is offline.
   *
   * Return: 200 { channel, session: LiveSession | null }
   */
  server.get<{ Params: { slug: string } }>(
    "/channels/:slug",
    {
      schema: {
        params: {
          type: "object",
          required: ["slug"],
          properties: {
            slug: { type: "string", minLength: 2, maxLength: 40, pattern: "^[a-z0-9-]+$" },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;

      const { data: channel, error: channelError } = await supabaseAdmin!
        .from("channels")
        .select("id, slug, display_name, description, created_at")
        .eq("slug", slug)
        .single();

      if (channelError || !channel) {
        return reply.status(404).send({ error: "Channel not found" });
      }

      // Fetch the most recent session that hasn't ended — the "active" session
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("*")
        .eq("channel_id", channel.id)
        .neq("status", "ended")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return reply.status(200).send({
        channel,
        session: session ?? null,
      });
    }
  );
}
