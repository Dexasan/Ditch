import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/csrf";
export const dynamic = "force-dynamic";
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!["GET", "HEAD"].includes(request.method) && !isSameOriginRequest(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { path } = await context.params;
  if (path.some(p => !/^[a-zA-Z0-9_-]+$/.test(p)) || (path[0] === "auth" && path.join("/") !== "auth/realtime-ticket")) return Response.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = user ? await supabase.auth.getSession() : { data: { session: null } };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const participantToken = request.headers.get("x-participant-token");
  if (participantToken && participantToken.length <= 512) headers["X-Participant-Token"] = participantToken;
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    if (Number(request.headers.get("content-length")) > 1024 * 1024) return new Response(null, { status: 413 });
    body = await request.text();
    if (new TextEncoder().encode(body).length > 1024 * 1024) return new Response(null, { status: 413 });
  }
  const url = new URL(`/${path.join("/")}`, process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002");
  url.search = new URL(request.url).search;
  try {
    const response = await fetch(url, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch { return Response.json({ error: "Service unavailable" }, { status: 503 }); }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as PUT };
