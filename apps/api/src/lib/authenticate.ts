import type { FastifyRequest, FastifyReply } from "fastify";
import type { VerifiedUser } from "@ditch/db";
import { verifyAccessToken } from "@ditch/db";

// Augment FastifyRequest so downstream handlers can access request.user
declare module "fastify" {
  interface FastifyRequest {
    user: VerifiedUser;
  }
}

/**
 * Fastify preHandler — verifies the Supabase access token in the Authorization
 * header and attaches the caller's identity to request.user.
 *
 * Verification is local (JWT signature) whenever SUPABASE_JWT_SECRET is set, so
 * authenticated routes keep serving even if Supabase Auth is unreachable.
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

  const user = await verifyAccessToken(authHeader.slice(7));

  if (!user) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }

  request.user = user;
}
