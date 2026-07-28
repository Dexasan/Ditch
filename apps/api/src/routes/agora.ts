import type { FastifyInstance } from "fastify";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import { verifyParticipantToken } from "../lib/participantToken";

const APP_ID          = process.env.AGORA_APP_ID ?? "";
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? "";
const TOKEN_TTL_SECS  = 3600; // 1 hour; client renews at the 30-second warning

// NEXT_PUBLIC_AGORA_APP_ID is inlined into the browser bundle, so the App ID is
// public by construction. The App Certificate is the only thing that stops a
// stranger who read it out of the bundle from publishing into any RTC channel.
// Without a certificate Agora runs in "testing mode" (null tokens, no auth),
// which is fine locally and unacceptable in production, so fail closed there,
// the same way the LiveKit route refuses to run without its secrets.
const TOKEN_AUTH_REQUIRED = process.env.NODE_ENV === "production";

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
   *   uid 1-4      -> PUBLISHER token, caller must be a live participant holding
   *                  slot uid - 1, proven either by their Supabase identity or
   *                  by the participant_token issued at POST /participants
   *   uid 998–999  → PUBLISHER token, caller must own the session's channel
   *
   * Returns { token: string | null, expires_in: number }
   * token is null when AGORA_APP_CERTIFICATE is not configured (testing mode).
   */
  server.get<{ Querystring: { session_id: string; uid: number; participant_token?: string } }>(
    "/agora/token",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["session_id", "uid"],
          properties: {
            session_id:        { type: "string", format: "uuid" },
            uid:               { type: "integer", minimum: 0, maximum: 999 },
            // Issued by POST /participants. Lets a guest with no account prove
            // which participant row is theirs; see lib/participantToken.
            participant_token: { type: "string", maxLength: 512 },
          },
        },
      },
    },
    async (request, reply) => {
      const { session_id, uid, participant_token } = request.query;

      if (TOKEN_AUTH_REQUIRED && (!APP_ID || !APP_CERTIFICATE)) {
        request.log.error(
          "AGORA_APP_CERTIFICATE is not set: refusing to issue unauthenticated RTC tokens",
        );
        return reply.status(503).send({ error: "Agora token auth is not configured" });
      }

      // Verify the session exists and hasn't ended — don't issue tokens for
      // finished broadcasts. This runs for audience viewers too: a subscriber
      // token is still a key to a live room, so it should not be mintable for an
      // arbitrary or already-ended session id.
      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id, status, channels!inner(owner_id)")
        .eq("id", session_id)
        .single();

      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (session.status === "ended") {
        return reply.status(403).send({ error: "Session has ended" });
      }

      // ── uid 0: audience viewer — no auth required ────────────────────────────
      if (uid === 0) {
        const token = makeToken(session_id, 0, RtcRole.SUBSCRIBER);
        return reply.send({ token, expires_in: TOKEN_TTL_SECS });
      }

      // uid 1-4 via participant credential: guest with no account
      // Checked before authenticate() so an anonymous guest is never bounced for
      // lacking an Authorization header. The credential only says which
      // participant row is asking; the row itself still has to be live and hold
      // the slot, which is the same bar the signed-in path clears below.
      if (PARTICIPANT_UIDS.has(uid) && participant_token) {
        const participantId = verifyParticipantToken(participant_token, session_id);
        if (!participantId) {
          return reply.status(403).send({ error: "Invalid participant token" });
        }

        const { data: participant } = await supabaseAdmin!
          .from("participants")
          .select("id")
          .eq("id", participantId)
          .eq("session_id", session_id)
          .eq("status", "live")
          .eq("slot_index", uid - 1)
          .maybeSingle();

        if (!participant) {
          return reply.status(403).send({ error: "No live participant record for this slot" });
        }

        const token = makeToken(session_id, uid, RtcRole.PUBLISHER);
        return reply.send({ token, expires_in: TOKEN_TTL_SECS });
      }

      // All other UIDs require authentication.
      await authenticate(request, reply);
      if (reply.sent) return; // authenticate already responded with 401
      const userId = request.user.id;

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
