import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AccessToken } from "livekit-server-sdk";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

const CREATOR_UIDS = new Set([997, 998, 999]);
const PARTICIPANT_UIDS = new Set([1, 2, 3, 4]);
const TOKEN_TTL = "6h";

export async function livekitRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { session_id: string; uid: number } }>(
    "/livekit/token",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["session_id", "uid"],
          properties: {
            session_id: { type: "string", format: "uuid" },
            uid: { type: "integer", minimum: 0, maximum: 999 },
          },
        },
      },
    },
    async (request, reply) => {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const url = process.env.LIVEKIT_URL;
      if (!apiKey || !apiSecret || !url) {
        return reply.status(503).send({ error: "LiveKit is not configured" });
      }

      const { session_id, uid } = request.query;
      let canPublish = false;
      let identity = `audience-${randomUUID()}`;

      // Validate the session for every caller, audience included. A join token
      // is still a key to a room, so it should not be mintable for an arbitrary
      // or already-ended session id.
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();
      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (session.status === "ended") {
        return reply.status(403).send({ error: "Session has ended" });
      }

      if (uid !== 0) {
        await authenticate(request, reply);
        if (reply.sent) return;

        const userId = request.user.id;
        const channel = session.channels as { owner_id: string };
        if (CREATOR_UIDS.has(uid)) {
          if (channel.owner_id !== userId) {
            return reply.status(403).send({ error: "Forbidden" });
          }
        } else if (PARTICIPANT_UIDS.has(uid)) {
          const { data: participant } = await supabaseAdmin!
            .from("participants")
            .select("id")
            .eq("session_id", session_id)
            .eq("user_id", userId)
            .eq("status", "live")
            .eq("slot_index", uid - 1)
            .maybeSingle();
          if (!participant) {
            return reply.status(403).send({ error: "No live participant record for this slot" });
          }
        } else {
          return reply.status(400).send({ error: "Invalid UID" });
        }
        canPublish = true;
        identity = String(uid);
      }

      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: TOKEN_TTL,
        metadata: JSON.stringify({ uid }),
      });
      accessToken.addGrant({
        roomJoin: true,
        room: session_id,
        canPublish,
        canSubscribe: true,
      });
      return reply.send({
        token: await accessToken.toJwt(),
        url,
        identity,
        expires_in: 21_600,
      });
    },
  );
}
