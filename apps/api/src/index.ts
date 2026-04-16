import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get("/health", async () => ({ status: "ok" }));

// Phase 1 routes (to be implemented):
// POST   /auth/signup
// POST   /auth/signin
// GET    /channels/:slug
// POST   /sessions                        — start a live session
// PATCH  /sessions/:id                    — update session state
// DELETE /sessions/:id                    — end a session
// GET    /sessions/:id/destinations       — list RTMP destinations
// POST   /sessions/:id/destinations       — add a destination (platform + stream key)
// DELETE /sessions/:id/destinations/:did  — remove a destination
// GET    /sessions/:id/participants       — list participant queue
// PATCH  /sessions/:id/participants/:pid  — approve or remove a participant

const PORT = Number(process.env.PORT) || 3001;

server.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
