import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import LiveRoom from "./LiveRoom";

export default async function LivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Auth required
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) redirect("/auth");

  const token = authSession.access_token;

  // Fetch channel (public route, no auth needed)
  const result = await api
    .get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`)
    .catch(() => null);

  if (!result) notFound();

  const { channel, session } = result;

  // Only the channel owner can access the live control room
  if (channel.owner_id !== authSession.user.id) redirect(`/c/${slug}`);

  // No active session → send back to dashboard
  if (!session || session.status === "ended") redirect("/dashboard");

  const creatorName =
    authSession.user.user_metadata?.display_name ??
    authSession.user.email?.split("@")[0] ??
    "Creator";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-surface-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="font-bold tracking-tight text-sm">DITCH</a>
          <span className="text-[var(--color-text-muted)] text-sm">/</span>
          <span className="text-sm">{channel.display_name}</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {session.status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/c/${slug}`}
            target="_blank"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            View channel ↗
          </a>
          <a
            href="/dashboard"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Dashboard
          </a>
        </div>
      </header>

      <LiveRoom sessionId={session.id} token={token} creatorName={creatorName} />
    </div>
  );
}
