import Fastify from "fastify";
import cors from "@fastify/cors";
import { validateEnv } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { sessionRoutes } from "./routes/sessions";
import { destinationRoutes } from "./routes/destinations";
import { participantRoutes } from "./routes/participants";

validateEnv();

const server = Fastify({ logger: true });

// Allowed origins: comma-separated WEB_URL env var + any *.vercel.app preview URL
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const explicit = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",").map((s) => s.trim());
  return explicit.includes(origin) || origin.endsWith(".vercel.app");
}

async function start() {
  // ── Plugins ──────────────────────────────────────────────────────────────

  await server.register(cors, {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
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
