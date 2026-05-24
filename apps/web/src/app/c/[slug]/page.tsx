import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession, CommunityPost } from "@ditch/types";
import ChannelView from "./ChannelView";
import CommunityTab from "./CommunityTab";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab }  = await searchParams;

  const result = await api
    .get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`)
    .catch(() => null);

  if (!result) notFound();

  const { channel, session } = result;

  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token      = authSession?.access_token ?? null;
  const viewerName = authSession?.user.user_metadata?.display_name ?? null;

  let isOwner = false;
  if (authSession) {
    const { channel: myChannel } = await api
      .get<{ channel: { slug: string } | null }>("/channels/mine", { token: authSession.access_token })
      .catch(() => ({ channel: null }));
    isOwner = myChannel?.slug === slug;
  }

  const isLive = !!(session && session.status !== "ended");

  // Default tab: community when offline, live when streaming
  const activeTab = tab === "community" ? "community" : tab === "live" ? "live" : (isLive ? "live" : "community");

  // Fetch community posts when community tab is active
  const { posts: initialPosts } = activeTab === "community"
    ? await api
        .get<{ posts: CommunityPost[] }>(`/channels/${slug}/community`, token ? { token } : undefined)
        .catch(() => ({ posts: [] as CommunityPost[] }))
    : { posts: [] as CommunityPost[] };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0A14" }}>
      {/* Header */}
      <header className="border-b border-white/6 px-6 py-3.5 flex items-center gap-3">
        <a href="/home"><img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" /></a>
        <span className="text-white/25 text-sm">/</span>
        <span className="font-semibold text-white text-sm">{channel.display_name}</span>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#FF1DB4] bg-[#FF1DB4]/10 px-2 py-0.5 rounded-full border border-[#FF1DB4]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF1DB4] animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[11px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}

        {/* Tab switcher */}
        <div className="ml-auto flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <a
            href={`/c/${slug}?tab=live`}
            className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
            style={{
              background: activeTab === "live" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "live" ? "white" : "rgba(255,255,255,0.35)",
            }}
          >
            {isLive ? "● Live" : "Live"}
          </a>
          <a
            href={`/c/${slug}?tab=community`}
            className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
            style={{
              background: activeTab === "community" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "community" ? "white" : "rgba(255,255,255,0.35)",
            }}
          >
            Community
          </a>
        </div>
      </header>

      {/* Content */}
      {activeTab === "live" ? (
        isLive && session ? (
          <ChannelView
            sessionId={session.id}
            token={token}
            viewerName={viewerName}
            isOwner={isOwner}
            channelSlug={slug}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(255,29,180,0.08)", border: "1px solid rgba(255,29,180,0.15)" }}
              >
                <span className="text-xl">📡</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white">{channel.display_name} is offline</p>
                <p className="text-sm text-white/40">
                  {channel.description ?? "Check back soon."}
                </p>
              </div>
            </div>
            <a
              href={`/c/${slug}?tab=community`}
              className="text-xs font-semibold text-[#FF1DB4] hover:text-white transition-colors"
            >
              See the community →
            </a>
          </div>
        )
      ) : (
        <CommunityTab
          channelSlug={slug}
          initialPosts={initialPosts}
          token={token}
        />
      )}
    </div>
  );
}
