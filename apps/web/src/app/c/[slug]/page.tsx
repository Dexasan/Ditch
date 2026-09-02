import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import type { CommunityPostV2 } from "@ditch/types/src/community";
import ChannelView from "./ChannelView";
import CommunityBoard from "./CommunityBoard";
import ChannelSubscribeButton from "@/components/ChannelSubscribeButton";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const result = await api
    .get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`)
    .catch(() => null);

  if (!result) notFound();
  const { channel, session } = result;

  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token ?? null;
  const viewerName = authSession?.user.user_metadata?.display_name ?? null;

  const isLive = Boolean(session && session.status !== "ended");
  const activeTab = tab === "community" ? "community" : tab === "live" ? "live" : (isLive ? "live" : "community");
  const isActiveLiveSession = activeTab === "live" && isLive && Boolean(session);

  type CommunityPayload = {
    posts: CommunityPostV2[];
    is_member: boolean;
    member_count: number;
    is_owner: boolean;
  };
  const emptyCommunity: CommunityPayload = {
    posts: [],
    is_member: false,
    member_count: 0,
    is_owner: false,
  };
  const community = activeTab === "community"
    ? await api
        .get<CommunityPayload>(`/channels/${slug}/community-v2`, token ? { token } : undefined)
        .catch(() => emptyCommunity)
    : await api
        .get<Omit<CommunityPayload, "posts">>(`/channels/${slug}/community-summary`, token ? { token } : undefined)
        .then((summary) => ({ ...summary, posts: [] as CommunityPostV2[] }))
        .catch(() => emptyCommunity);
  const isOwner = community.is_owner;

  return (
    <div
      className="flex min-w-0 max-w-full flex-col overflow-x-hidden"
      style={{
        background: "#0A0A14",
        minHeight: "100dvh",
        height: isActiveLiveSession ? "100dvh" : undefined,
        overflowY: isActiveLiveSession ? "hidden" : undefined,
      }}
    >
      <header className="channel-header flex min-w-0 shrink-0 flex-wrap items-center gap-2.5 border-b border-white/6 sm:flex-nowrap sm:gap-3">
        <Link href="/home" className="shrink-0"><img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" /></Link>
        <span className="channel-header-divider shrink-0 text-sm text-white/25">/</span>
        <span className="channel-header-name min-w-0 truncate text-sm font-semibold text-white">{channel.display_name}</span>
        {isLive ? (
          <span className="channel-live-pill flex shrink-0 items-center gap-1.5 rounded-full border border-[#FF1DB4]/20 bg-[#FF1DB4]/10 px-2 py-0.5 text-[12px] font-bold text-[#FF1DB4]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF1DB4] animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[12px] text-white/30">Offline</span>
        )}

        <div className="channel-page-tabs ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-white/5 p-1">
          <Link
            href={`/c/${slug}?tab=live`}
            className="channel-page-tab rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3"
            style={{
              background: activeTab === "live" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "live" ? "white" : "rgba(255,255,255,0.35)",
            }}
          >
            {isLive ? "● Live" : "Live"}
          </Link>
          <Link
            href={`/c/${slug}?tab=community`}
            className="channel-page-tab rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3"
            style={{
              background: activeTab === "community" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "community" ? "white" : "rgba(255,255,255,0.35)",
            }}
          >
            Community
          </Link>
        </div>
        {activeTab === "live" && (
          <div className="order-last flex w-full justify-end border-t border-white/5 pt-2 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
            <ChannelSubscribeButton
              channelSlug={slug}
              token={token}
              initialSubscribed={community.is_member}
              initialCount={community.member_count}
              isOwner={isOwner}
              compact
            />
          </div>
        )}
      </header>

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
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="space-y-3 text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "rgba(255,29,180,0.08)", border: "1px solid rgba(255,29,180,0.15)" }}
              >
                <span className="text-xl">◉</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white">{channel.display_name} is offline</p>
                <p className="text-sm text-white/40">{channel.description ?? "Check back soon."}</p>
              </div>
            </div>
            <Link href={`/c/${slug}?tab=community`} className="text-xs font-semibold text-[#FF1DB4] hover:text-white">
              See the community →
            </Link>
          </div>
        )
      ) : (
        <CommunityBoard
          channelSlug={slug}
          initialPosts={community.posts}
          token={token}
          initialIsMember={community.is_member}
          initialMemberCount={community.member_count}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
