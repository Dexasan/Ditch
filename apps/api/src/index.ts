import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { supabaseAdmin } from "@ditch/db";
import { validateEnv } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { sessionRoutes } from "./routes/sessions";
import { destinationRoutes } from "./routes/destinations";
import { savedDestinationRoutes } from "./routes/saved-destinations";
import { participantRoutes } from "./routes/participants";
import { communityRoutes } from "./routes/community";
import { communityV2Routes } from "./routes/community-v2";
import { consoleRoutes } from "./routes/console";
import { agoraRoutes } from "./routes/agora";
import { livekitRoutes } from "./routes/livekit";
import { relayRoutes } from "./routes/relay";
import { ingestRoutes } from "./routes/ingest";

validateEnv();

const server = Fastify({
  logger: {
    serializers: { req: req => ({ method: req.method, url: req.url?.split("?")[0], remoteAddress: req.ip }) },
    redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "req.body.captchaToken"],
  },
});

// Allowed origins: explicit WEB_URL list + preview deployments scoped to VERCEL_TEAM_SLUG.
// No-origin requests (curl, server scripts) are denied — CORS is browser-enforced only.
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",").map((s) => s.trim());
  if (explicit.includes(origin)) return true;
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

  // Cookie auth belongs to the web BFF. This service accepts explicit bearer
  // credentials only; reject cross-site browser mutations as defense in depth.
  server.addHook("onRequest", async (request, reply) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.origin && !isOriginAllowed(request.headers.origin)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  });
  server.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "private, no-store");
    return payload;
  });

  // ── Routes ───────────────────────────────────────────────────────────────

  server.get("/health", async () => {
    const { error } = await supabaseAdmin!.from("channels").select("id").limit(1);
    if (error) return { status: "degraded" };
    return { status: "ok" };
  });

  await server.register(authRoutes);
  await server.register(channelRoutes);
  await server.register(sessionRoutes);
  await server.register(destinationRoutes);
  await server.register(savedDestinationRoutes);
  await server.register(participantRoutes);
  await server.register(communityRoutes);
  await server.register(communityV2Routes);
  await server.register(consoleRoutes);
  await server.register(agoraRoutes);
  await server.register(livekitRoutes);
  await server.register(relayRoutes);
  await server.register(ingestRoutes);

  // ── Start ─────────────────────────────────────────────────────────────────

  const PORT = Number(process.env.API_PORT) || 3002;

  await server.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
