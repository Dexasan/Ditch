import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { sessionRoutes } from "./routes/sessions";

const server = Fastify({ logger: true });

async function start() {
  // ── Plugins ──────────────────────────────────────────────────────────────

  await server.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });

  // ── Routes ───────────────────────────────────────────────────────────────

  server.get("/health", async () => ({ status: "ok" }));

  await server.register(authRoutes);
  await server.register(channelRoutes);
  await server.register(sessionRoutes);

  // Phase 1 routes (to be implemented):
  // GET    /sessions/:id/destinations       — list RTMP destinations
  // POST   /sessions/:id/destinations       — add a destination (platform + stream key)
  // DELETE /sessions/:id/destinations/:did  — remove a destination
  // GET    /sessions/:id/participants       — list participant queue
  // PATCH  /sessions/:id/participants/:pid  — approve or remove a participant

  // ── Start ─────────────────────────────────────────────────────────────────

  const PORT = Number(process.env.PORT) || 3001;

  await server.listen({ port: PORT, host: "0.0.0.0" });
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
