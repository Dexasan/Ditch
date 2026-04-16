import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "@ditch/db";

export async function channelRoutes(server: FastifyInstance) {
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
            slug: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;

      const { data: channel, error: channelError } = await supabaseAdmin!
        .from("channels")
        .select("*")
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
