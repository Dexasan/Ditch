import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { validateEnv } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { sessionRoutes } from "./routes/sessions";
import { destinationRoutes } from "./routes/destinations";
import { participantRoutes } from "./routes/participants";

validateEnv();

const server = Fastify({
  logger: {
    redact: ["req.headers.authorization"],
  },
});

// Allowed origins: explicit WEB_URL list + preview deployments scoped to VERCEL_TEAM_SLUG.
// No-origin requests (curl, server scripts) are denied — CORS is browser-enforced only.
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",").map((s) => s.trim());
  if (explicit.includes(origin)) return true;
  const teamSlug = process.env.VERCEL_TEAM_SLUG;
  if (teamSlug) {
    return new RegExp(`^https://[\\w-]+-${teamSlug}\\.vercel\\.app$`).test(origin);
  }
  return false;
}

async function start() {
  // ── Plugins ──────────────────────────────────────────────────────────────

  await server.register(cors, {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
  });

  await server.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
  });

  // ── Routes ───────────────────────────────────────────────────────────────

  server.get("/health", async () => ({ status: "ok" }));

  await server.register(authRoutes);
  await server.register(channelRoutes);
  await server.register(sessionRoutes);
  await server.register(destinationRoutes);
  await server.register(participantRoutes);

  // ── Start ─────────────────────────────────────────────────────────────────

  const PORT = Number(process.env.API_PORT) || 3002;

  await server.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
