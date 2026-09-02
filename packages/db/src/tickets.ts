import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { VerifiedUser } from "./auth";

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server credential is missing");
  return createHash("sha256").update(`ditch:service-ticket:v1:${secret}`).digest();
}
export async function issueServiceTicket(user: VerifiedUser, audience: "realtime" | "relay", sessionId?: string) {
  return new SignJWT({ display_name: user.display_name, sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("ditch")
    .setSubject(user.id).setAudience(audience).setIssuedAt().setExpirationTime("5m").sign(key());
}
export async function verifyServiceTicket(token: string, audience: "realtime" | "relay", sessionId?: string): Promise<VerifiedUser | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "ditch", audience, algorithms: ["HS256"] });
    if (!payload.sub || (audience === "relay" && payload.sid !== sessionId)) return null;
    return { id: payload.sub, email: null, display_name: typeof payload.display_name === "string" ? payload.display_name : null };
  } catch { return null; }
}
