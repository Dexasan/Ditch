import { createHmac, createHash, timingSafeEqual } from "node:crypto";

/**
 * Scoped credentials for anonymous participants.
 *
 * `POST /participants` accepts viewers with no account, so a guest can be
 * approved onto a slot without ever signing in. The RTC token routes, however,
 * identify guests by `auth.uid()`, which an anonymous guest does not have. That
 * mismatch used to be papered over: the token request 401'd, the client
 * swallowed it, and Agora accepted the resulting null token only because the
 * project had token auth disabled. Enforcing auth would have broken every
 * anonymous guest permanently.
 *
 * So the API hands each new participant a signed credential proving one claim:
 * "bearer is participant <pid> of session <sid>". It carries no privileges of
 * its own. The RTC routes still load the participant row and check that it is
 * `live` and holds the slot being requested, exactly as they do for signed-in
 * guests. The credential only answers *which* participant is asking.
 *
 * Signing key is derived from the service-role key rather than adding a new
 * required env var, which would be a deploy footgun on every service that
 * imports this. Derivation is one-way, so it does not weaken the source key.
 * Rotating the service-role key invalidates outstanding credentials, which is
 * fine: they live at most as long as a broadcast.
 */

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // outlives any realistic broadcast

function signingKey(): Buffer {
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!source) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to sign participant tokens");
  return createHash("sha256").update(`ditch:participant-token:v1:${source}`).digest();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

interface Claims {
  pid: string;
  sid: string;
  exp: number;
}

export function issueParticipantToken(participantId: string, sessionId: string): string {
  const claims: Claims = {
    pid: participantId,
    sid: sessionId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payload = b64url(JSON.stringify(claims));
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Returns the participant id the token proves, or null if it is malformed,
 * expired, tampered with, or scoped to a different session.
 */
export function verifyParticipantToken(token: string, expectedSessionId: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }

  if (typeof claims.pid !== "string" || typeof claims.sid !== "string") return null;
  if (claims.sid !== expectedSessionId) return null;
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;

  return claims.pid;
}
