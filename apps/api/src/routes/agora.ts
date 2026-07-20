import type { FastifyInstance } from "fastify";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

const APP_ID          = process.env.AGORA_APP_ID ?? "";
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? "";
const TOKEN_TTL_SECS  = 3600; // 1 hour; client renews at the 30-second warning

// UID authorisation rules:
//   0          → audience subscriber, no auth required
//   1-4        → participant publisher, must be authenticated + live in that session's slot
//   998-999    → creator publisher (screen / cam), must own the session's channel
//   anything else → 400
const CREATOR_UIDS     = new Set([997, 998, 999]);
const PARTICIPANT_UIDS = new Set([1, 2, 3, 4]);

function makeToken(channelName: string, uid: number, role: number): string | null {
  if (!APP_ID || !APP_CERTIFICATE) return null;
  return RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    TOKEN_TTL_SECS,
    TOKEN_TTL_SECS,
  );
}

export async function agoraRoutes(server: FastifyInstance) {
  /**
   * GET /agora/token?session_id=<uuid>&uid=<number>
   *
   * Issues an Agora RTC token scoped to the given session (which is also the
   * Agora channel name) and UID. Auth requirements vary by UID:
   *
   *   uid 0        → SUBSCRIBER token, no auth (audience viewer)
   *   uid 1–4      → PUBLISHER token, caller must be an authenticated live
   *                  participant whose slot_index matches uid - 1
   *   uid 998–999  → PUBLISHER token, caller must own the session's channel
   *
   * Returns { token: string | null, expires_in: number }
   * token is null when AGORA_APP_CERTIFICATE is not configured (testing mode).
   */
  server.get<{ Querystring: { session_id: string; uid: number } }>(
    "/agora/token",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["session_id", "uid"],
          properties: {
            session_id: { type: "string", format: "uuid" },
            uid:        { type: "integer", minimum: 0, maximum: 999 },
          },
        },
      },
    },
    async (request, reply) => {
      const { session_id, uid } = request.query;

      // ── uid 0: audience viewer — no auth required ────────────────────────────
      if (uid === 0) {
        const token = makeToken(session_id, 0, RtcRole.SUBSCRIBER);
        return reply.send({ token, expires_in: TOKEN_TTL_SECS });
      }

      // All other UIDs require authentication.
      await authenticate(request, reply);
      if (reply.sent) return; // authenticate already responded with 401
      const userId = request.user.id;

      // Verify the session exists and hasn't ended — don't issue tokens for
      // finished broadcasts.
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();

      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (session.status === "ended") {
        return reply.status(403).send({ error: "Session has ended" });
      }

      const channel = session.channels as { owner_id: string };

      // ── uid 998–999: creator cam / screen-share ──────────────────────────────
      if (CREATOR_UIDS.has(uid)) {
        if (channel.owner_id !== userId) {
          return reply.status(403).send({ error: "Forbidden" });
        }
        const token = makeToken(session_id, uid, RtcRole.PUBLISHER);
        return reply.send({ token, expires_in: TOKEN_TTL_SECS });
      }

      // ── uid 1–4: live participant slot ───────────────────────────────────────
      if (PARTICIPANT_UIDS.has(uid)) {
        const slotIndex = uid - 1;

        const { data: participant } = await supabaseAdmin!
          .from("participants")
          .select("id, status, slot_index")
          .eq("session_id", session_id)
          .eq("user_id", userId)
          .eq("status", "live")
          .eq("slot_index", slotIndex)
          .maybeSingle();

        if (!participant) {
          return reply.status(403).send({ error: "No live participant record for this slot" });
        }

        const token = makeToken(session_id, uid, RtcRole.PUBLISHER);
        return reply.send({ token, expires_in: TOKEN_TTL_SECS });
      }

      return reply.status(400).send({ error: "Invalid UID" });
    },
  );
}
