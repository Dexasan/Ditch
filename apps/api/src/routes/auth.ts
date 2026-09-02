import type { FastifyInstance } from "fastify";
import { supabaseAdmin, issueServiceTicket } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

export async function authRoutes(server: FastifyInstance) {
  // Password auth is handled by the web BFF, which sets HttpOnly cookies.
  // Keeping the old token-returning endpoints would defeat that boundary.
  for (const path of ["/auth/signup", "/auth/signin"]) {
    server.post(path, { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (_request, reply) =>
      reply.status(410).send({ error: "Use the website to sign in or create an account." }));
  }
  server.post("/auth/signout", { preHandler: authenticate }, async (request, reply) => {
    const { error } = await supabaseAdmin!.auth.admin.signOut(request.headers.authorization!.slice(7), "global");
    if (error) {
      request.log.error({ code: error.code }, "Sign-out failed");
      return reply.status(503).send({ error: "Unable to sign out. Try again." });
    }
    return reply.send({ success: true });
  });
  server.post("/auth/realtime-ticket", { preHandler: authenticate }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { token: await issueServiceTicket(request.user, "realtime"), expires_in: 300 };
  });
}
