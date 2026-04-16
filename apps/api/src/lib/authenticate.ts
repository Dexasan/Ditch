import type { FastifyRequest, FastifyReply } from "fastify";
import type { User } from "@ditch/db";
import { supabaseAdmin } from "@ditch/db";

// Augment FastifyRequest so downstream handlers can access request.user
declare module "fastify" {
  interface FastifyRequest {
    user: User;
  }
}

/**
 * Fastify preHandler — validates the Supabase JWT in the Authorization header
 * and attaches the Supabase User to request.user.
 *
 * Usage:
 *   server.get("/protected", { preHandler: authenticate }, handler)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7);

  if (!supabaseAdmin) {
    return reply.status(500).send({ error: "Server misconfiguration: admin client unavailable" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }

  request.user = data.user;
}
