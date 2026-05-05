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

  // Auth required — getUser() verifies the token against the auth server,
  // unlike getSession() which only reads the local cookie without verification.
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth");

  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) redirect("/auth");

  const token = authSession.access_token;

  // Fetch channel and verify ownership in parallel.
  // owner_id is no longer in the public channel response — use /channels/mine
  // to confirm this creator owns the channel for this slug.
  const [result, ownershipResult] = await Promise.all([
    api.get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`).catch(() => null),
    api.get<{ channel: { slug: string } | null }>("/channels/mine", { token }).catch(() => ({ channel: null })),
  ]);

  if (!result) notFound();

  const { channel, session } = result;

  // Only the channel owner can access the live control room
  if (!ownershipResult.channel || ownershipResult.channel.slug !== slug) redirect(`/c/${slug}`);

  // No active session → send back to dashboard
  if (!session || session.status === "ended") redirect("/dashboard");

  const creatorName =
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
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
