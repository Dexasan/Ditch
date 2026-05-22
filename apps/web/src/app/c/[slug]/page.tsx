import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import ChannelView from "./ChannelView";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Public — no auth required to view
  const result = await api
    .get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`)
    .catch(() => null);

  if (!result) notFound();

  const { channel, session } = result;

  // Get viewer identity if logged in (for pre-filling display name + ownership check)
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token ?? null;
  const viewerName = authSession?.user.user_metadata?.display_name ?? null;

  // Ownership check: compare against the user's own channel — avoids exposing
  // owner_id in the public channel response.
  let isOwner = false;
  if (authSession) {
    const { channel: myChannel } = await api
      .get<{ channel: { slug: string } | null }>("/channels/mine", { token: authSession.access_token })
      .catch(() => ({ channel: null }));
    isOwner = myChannel?.slug === slug;
  }

  const isLive = session && session.status !== "ended";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-surface-border)] px-6 py-4 flex items-center gap-4">
        <a href="/"><img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" /></a>
        <span className="text-[var(--color-text-muted)] text-sm">/</span>
        <span className="font-semibold">{channel.display_name}</span>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] px-2 py-1 rounded-full">
            Offline
          </span>
        )}
      </header>

      {isLive && session ? (
        <ChannelView
          sessionId={session.id}
          token={token}
          viewerName={viewerName}
          isOwner={isOwner}
          channelSlug={slug}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-[var(--color-text-muted)]">{channel.display_name} is not live right now.</p>
            {channel.description && (
              <p className="text-sm text-[var(--color-text-muted)]">{channel.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
