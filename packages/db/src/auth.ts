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

import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import { supabaseAdmin } from "./client";

export interface VerifiedUser {
  id: string;
  email: string | null;
  display_name: string | null;
}

const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const secretKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

// Projects on Supabase's new JWT Signing Keys sign access tokens
// asymmetrically (ES256/RS256) rather than with the legacy shared secret, so
// the secret alone cannot verify them. The matching public keys are published
// at the project's JWKS endpoint. createRemoteJWKSet caches them in memory and
// only refetches when it sees an unknown `kid`, so this stays a local ~1ms
// check after the first call - and keeps working during an Auth outage.
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\\[rn]/g, "");
const jwks = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000, // 10 min
      cooldownDuration: 30 * 1000, // don't hammer on unknown kid
    })
  : null;

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

  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return null; // not a JWT at all
  }

  // Verify with the key material matching the signing algorithm:
  //   HS256               -> legacy shared secret (SUPABASE_JWT_SECRET)
  //   ES256/RS256/PS256   -> project's published JWKS (new JWT Signing Keys)
  // The two jwtVerify overloads (key vs. key-resolver) are called separately;
  // a union of both key types matches neither.
  const useSecret = alg === "HS256" && !!secretKey;
  const useJwks = !!alg && /^(ES|RS|PS)\d{3}$/.test(alg) && !!jwks;

  if (!useSecret && !useJwks) {
    // No usable key material for this algorithm (e.g. HS256 with no secret set).
    return verifyViaNetwork(token);
  }

  try {
    const { payload } = useSecret
      ? await jwtVerify(token, secretKey!, { audience: "authenticated", issuer: `${supabaseUrl}/auth/v1`, algorithms: useSecret ? ["HS256"] : ["ES256", "RS256", "PS256"] })
      : await jwtVerify(token, jwks!, { audience: "authenticated", issuer: `${supabaseUrl}/auth/v1`, algorithms: useSecret ? ["HS256"] : ["ES256", "RS256", "PS256"] });

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
  } catch (err) {
    // A bad signature or expired token is a definitive rejection. A JWKS
    // fetch/lookup failure is NOT - fall back to the network check rather than
    // locking everyone out because the key set could not be loaded.
    const name = (err as Error)?.name;
    if (name === "JWKSNoMatchingKey" || name === "JWKSInvalid" || name === "JWKSTimeout") {
      return verifyViaNetwork(token);
    }
    return null;
  }
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

/**
 * True when local verification is possible at all: either the legacy shared
 * secret is configured (HS256 projects) or the JWKS endpoint is derivable from
 * SUPABASE_URL (projects on JWT Signing Keys). False means every request pays
 * an Auth round trip.
 */
export const localJwtVerificationEnabled = !!secretKey || !!jwks;
