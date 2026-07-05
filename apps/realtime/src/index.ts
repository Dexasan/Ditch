import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./types.js";
import { authMiddleware } from "./middleware/auth.js";
import { registerHandlers } from "./handlers/index.js";
import { initIngest } from "./ingest/manager.js";
import { validateEnv } from "./lib/env.js";

validateEnv();

// Last-resort crash guards. A single stray rejection in an async socket handler
// (or in the auth middleware's getUser call) would otherwise terminate the whole
// process in Node ≥15 — dropping EVERY connected viewer's join + chat at once.
// Handlers try/catch their own bodies; reaching here means an error escaped that
// net, so log it loudly but keep serving the other clients rather than exiting.
process.on("unhandledRejection", (reason) => {
  console.error("[realtime] unhandledRejection — surviving:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[realtime] uncaughtException — surviving:", err);
});

const PORT = Number(process.env.REALTIME_PORT) || 3001;

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

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: {
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      credentials: true,
    },
  }
);

io.use(authMiddleware);

// Wire external chat ingestion (Twitch/YouTube) to this Socket.io server.
initIngest(io);

io.on("connection", (socket) => {
  console.log(`[realtime] socket ${socket.id} connected (user_id: ${socket.data.user_id ?? "anon"})`);
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on port ${PORT}`);
});
