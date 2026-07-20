import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

function stableIndex(value: string, size: number) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

export async function relayRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { session_id: string } }>(
    "/relay/assignment",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["session_id"],
          properties: { session_id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      await authenticate(request, reply);
      if (reply.sent) return;

      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, channels!inner(owner_id)")
        .eq("id", request.query.session_id)
        .single();
      if (!session) return reply.status(404).send({ error: "Session not found" });
      const channel = session.channels as { owner_id: string };
      if (channel.owner_id !== request.user.id) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const urls = (process.env.RELAY_URLS ?? process.env.RELAY_URL ?? "ws://localhost:3003")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
      const relay_url = urls[stableIndex(request.query.session_id, urls.length)];
      return reply.send({ relay_url, pool_size: urls.length });
    },
  );
}
