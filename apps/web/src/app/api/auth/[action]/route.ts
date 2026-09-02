import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/csrf";
export const dynamic = "force-dynamic";
const attempts = new Map<string, { count: number; until: number }>();
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!isSameOriginRequest(request)) return json({ error: "Forbidden" }, 403);
  const { action } = await context.params;
  const supabase = await createClient();
  if (action === "session") {
    const { data: { user } } = await supabase.auth.getUser();
    return json({ user }); // Never serialize a session or tokens.
  }
  if (action === "signout") {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) { process.stderr.write(JSON.stringify({ event: "signout_failed", code: error.code }) + "\n"); return json({ error: "Unable to sign out. Try again." }, 503); }
    return json({ success: true });
  }
  if (!["signin", "signup", "profile"].includes(action)) return json({ error: "Not found" }, 404);
  if (Number(request.headers.get("content-length")) > 8192) return json({ error: "Request too large" }, 413);
  const raw = await request.text();
  if (raw.length > 8192) return json({ error: "Request too large" }, 413);
  let body: { email?: string; password?: string; display_name?: string; captchaToken?: string };
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "Invalid request" }, 400);
  if (action === "profile") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    if (typeof body.display_name !== "string" || !body.display_name.trim() || body.display_name.length > 64) return json({ error: "Invalid display name" }, 400);
    const { error } = await supabase.auth.updateUser({ data: { display_name: body.display_name.trim() } });
    return json(error ? { error: "Unable to update profile" } : { success: true }, error ? 400 : 200);
  }
  const message = action === "signin" ? "Unable to sign in. Check your details and try again." : "Unable to create an account. Please try again.";
  // Per-runtime defense in depth. Supabase's native limits and CAPTCHA must
  // also protect direct Auth API calls and requests across runtime instances.
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const ip = process.env.VERCEL ? request.headers.get("x-forwarded-for") ?? "unknown" : "local";
  const key = `${action}:${ip}`;
  const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  entry.count++;
  if (attempts.size >= 10000 && !attempts.has(key)) return json({ error: message }, 429);
  attempts.set(key, entry);
  if (entry.count > (action === "signin" ? 10 : 5)) return json({ error: message }, 429);
  if (typeof body.email !== "string" || body.email.length > 254 || !body.email.includes("@") || typeof body.password !== "string" || body.password.length > 1024 || body.password.length < (action === "signup" ? 12 : 1)) return json({ error: message }, 400);
  if (process.env.NODE_ENV === "production" && (!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || typeof body.captchaToken !== "string" || !body.captchaToken)) return json({ error: message }, 503);
  // Configure hCaptcha's secret in Supabase project Auth settings before launch.
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;
  const result = action === "signup"
    ? await supabase.auth.signUp({ email: body.email, password: body.password, options: {
        captchaToken, emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
        data: { display_name: typeof body.display_name === "string" ? body.display_name.slice(0, 64) : undefined },
      } })
    : await supabase.auth.signInWithPassword({ email: body.email, password: body.password, options: { captchaToken } });
  if (result.error) {
    process.stderr.write(JSON.stringify({ event: "auth_failed", action, code: result.error.code, status: result.error.status }) + "\n");
    if (action === "signup" && ["user_already_exists", "email_exists"].includes(result.error.code ?? "")) return json({ success: true });
    return json({ error: message }, action === "signin" ? 401 : 400);
  }
  return json(action === "signup" ? { success: true } : { user: result.data.user });
}
