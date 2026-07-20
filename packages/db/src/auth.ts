// Access-token verification shared by the api, realtime and relay services.
//
// Supabase signs access tokens with the project's JWT secret (HS256), so the
// signature can be checked locally with zero network calls. The previous
// approach - supabaseAdmin.auth.getUser(token) - was an HTTP round trip to
// Supabase Auth on EVERY authenticated request, which cost 100-500ms of stream
// start latency and, worse, made every service hard-fail whenever Supabase was
// unreachable (a Railway egress incident took the whole product down that way).
//
// Local verification keeps authenticated traffic serving through an Auth
// outage. The network path is retained only for projects using asymmetric
// signing keys, or when SUPABASE_JWT_SECRET is not configured.

import { decodeProtectedHeader, jwtVerify } from "jose";
import { supabaseAdmin } from "./client";

export interface VerifiedUser {
  id: string;
  email: string | null;
  display_name: string | null;
}

const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const secretKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

function displayNameFrom(
  metadata: Record<string, unknown> | undefined,
  email: string | null,
): string | null {
  const fromMeta = metadata?.["display_name"];
  if (typeof fromMeta === "string" && fromMeta) return fromMeta;
  return email ? email.split("@")[0] : null;
}

/**
 * Verifies a Supabase access token and returns the caller's identity, or null
 * when the token is missing, malformed, expired or not signed for this project.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedUser | null> {
  if (!token) return null;

  if (secretKey) {
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      return null; // not a JWT at all
    }

    // HS256 = shared-secret project, which is what SUPABASE_JWT_SECRET verifies.
    // Projects migrated to asymmetric signing keys (ES256/RS256) fall through
    // to the network check instead of being wrongly rejected.
    if (alg === "HS256") {
      try {
        const { payload } = await jwtVerify(token, secretKey, {
          audience: "authenticated",
        });
        if (!payload.sub) return null;
        const email = typeof payload["email"] === "string" ? payload["email"] : null;
        return {
          id: payload.sub,
          email,
          display_name: displayNameFrom(
            payload["user_metadata"] as Record<string, unknown> | undefined,
            email,
          ),
        };
      } catch {
        // Bad signature or expired - a definitive rejection, so do NOT fall
        // back to the network (that would only fail slower).
        return null;
      }
    }
  }

  return verifyViaNetwork(token);
}

async function verifyViaNetwork(token: string): Promise<VerifiedUser | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const email = data.user.email ?? null;
    return {
      id: data.user.id,
      email,
      display_name: displayNameFrom(data.user.user_metadata, email),
    };
  } catch {
    // Network failure - treat as unauthenticated rather than throwing, so
    // callers can answer 401 instead of crashing.
    return null;
  }
}

/** True when tokens are verified locally (no Supabase Auth round trip). */
export const localJwtVerificationEnabled = !!secretKey;
