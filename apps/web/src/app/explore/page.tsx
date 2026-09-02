import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import ConsoleHeader from "@/components/ConsoleHeader";
import ChannelSubscribeButton from "@/components/ChannelSubscribeButton";

type StreamPlatform = "twitch" | "youtube" | "tiktok" | "kick";
type PreviewPost = { id: string; title: string; type: "moment" | "discussion" | "suggestion"; status: string; created_at: string; vote_count: number; comment_count: number };
type LiveChannel = {
  session_id: string;
  live_since: string;
  channel: { id: string; slug: string; display_name: string; description: string | null };
  platforms: StreamPlatform[];
  on_screen: number;
  community?: { member_count: number; post_count: number; recent_posts: PreviewPost[] };
};
type CardProps = { item: LiveChannel; token: string | null; subscribed: boolean; isOwner: boolean };

const PLATFORMS: Record<StreamPlatform, { label: string; color: string; bg: string }> = {
  twitch: { label: "Twitch", color: "#9146FF", bg: "rgba(145,70,255,.18)" },
  youtube: { label: "YouTube", color: "#FF4444", bg: "rgba(255,68,68,.18)" },
  tiktok: { label: "TikTok", color: "#00E5D4", bg: "rgba(0,229,212,.18)" },
  kick: { label: "Kick", color: "#53FC18", bg: "rgba(83,252,24,.18)" },
};
const POST_LABEL = { suggestion: "Idea", discussion: "Conversation", moment: "Moment" };

function communityOf(item: LiveChannel) {
  return item.community ?? { member_count: 0, post_count: 0, recent_posts: [] };
}
function channelGradient(slug: string) {
  let hash = 0;
  for (const char of slug) hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  const first = hash % 360;
  return `linear-gradient(145deg,hsl(${first},55%,7%),hsl(${(first + 55) % 360},45%,14%) 60%,hsl(${first},60%,9%))`;
}
function LiveBadge() {
  return <span className="flex items-center gap-1.5 rounded-full border border-[#FF1DB4]/30 bg-[#FF1DB4]/15 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-[#FF1DB4]">
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF1DB4]" />Live
  </span>;
}
function PlatformPills({ platforms }: { platforms: StreamPlatform[] }) {
  return <div className="flex flex-wrap gap-1.5">{platforms.map((platform) => {
    const config = PLATFORMS[platform];
    return <span key={platform} className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}30` }}>{config.label}</span>;
  })}</div>;
}
function ChannelIdentity({ item, featured = false }: { item: LiveChannel; featured?: boolean }) {
  return <>
    <div className="flex items-center justify-between"><LiveBadge /><span className="text-xs font-medium text-white/65">
      {item.on_screen > 0 ? `${item.on_screen} on screen` : "Watch live"}
    </span></div>
    <div className={featured ? "flex flex-1 flex-col justify-center py-8" : "flex flex-1 flex-col justify-center py-5"}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[.08] text-lg font-black text-white">
        {item.channel.display_name[0].toUpperCase()}
      </div>
      <h2 className={featured ? "text-2xl font-bold text-white" : "text-lg font-bold text-white"}>{item.channel.display_name}</h2>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/65">{item.channel.description ?? "Broadcasting live on DITCH"}</p>
    </div>
    {item.platforms.length ? <PlatformPills platforms={item.platforms} /> : <span className="text-xs text-white/50">DITCH only</span>}
  </>;
}
function FeaturedCard({ item, token, subscribed, isOwner }: CardProps) {
  const community = communityOf(item);
  return <article className="flex h-full min-h-[390px] flex-col overflow-hidden rounded-2xl border border-white/10"
    style={{ background: channelGradient(item.channel.slug) }}>
    <Link href={`/c/${item.channel.slug}`} className="group flex flex-1 flex-col px-5 py-5"><ChannelIdentity item={item} featured /></Link>
    <div className="border-t border-white/10 bg-black/20 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <p className="text-xs font-bold uppercase tracking-[.17em] text-[#FF75CD]">Inside the community</p>
            <span className="text-xs text-white/50">{community.post_count} {community.post_count === 1 ? "post" : "posts"}</span>
          </div>
          {community.recent_posts.length ? <div className="grid gap-2 sm:grid-cols-2">
            {community.recent_posts.map((post) => <Link key={post.id} href={`/c/${item.channel.slug}/community/${post.id}`}
              className="min-w-0 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 hover:border-[#FF1DB4]/35">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-white/50">{POST_LABEL[post.type]}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-white/85">{post.title}</span>
              <span className="mt-1 block text-[11px] text-white/45">{post.vote_count} supports / {post.comment_count} replies</span>
            </Link>)}
          </div> : <Link href={`/c/${item.channel.slug}?tab=community`} className="text-xs text-white/55 hover:text-white">
            The community is quiet. See what you can start
          </Link>}
        </div>
        <ChannelSubscribeButton channelSlug={item.channel.slug} token={token} initialSubscribed={subscribed}
          initialCount={community.member_count} isOwner={isOwner} />
      </div>
    </div>
  </article>;
}
function ChannelCard({ item, token, subscribed, isOwner }: CardProps) {
  const community = communityOf(item);
  const latest = community.recent_posts[0];
  return <article className="flex h-full min-h-[250px] flex-col overflow-hidden rounded-xl border border-white/10"
    style={{ background: channelGradient(item.channel.slug) }}>
    <Link href={`/c/${item.channel.slug}`} className="group flex flex-1 flex-col px-4 py-4"><ChannelIdentity item={item} /></Link>
    <div className="border-t border-white/10 bg-black/20 px-4 py-3">
      {latest ? <Link href={`/c/${item.channel.slug}/community/${latest.id}`} className="mb-3 block min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF75CD]">Latest {POST_LABEL[latest.type]}</span>
        <span className="mt-0.5 block truncate text-xs text-white/75 hover:text-white">{latest.title}</span>
      </Link> : <Link href={`/c/${item.channel.slug}?tab=community`} className="mb-3 block text-xs text-white/50 hover:text-white">
        Community is ready for its first post
      </Link>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-white/50">{community.post_count} community {community.post_count === 1 ? "post" : "posts"}</span>
        <ChannelSubscribeButton channelSlug={item.channel.slug} token={token} initialSubscribed={subscribed}
          initialCount={community.member_count} isOwner={isOwner} compact />
      </div>
    </div>
  </article>;
}
function EmptyState({ signedIn }: { signedIn: boolean }) {
  return <div className="flex flex-col items-center justify-center py-28 text-center">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FF1DB4]/15 bg-[#FF1DB4]/[.07] text-[#FF1DB4]">
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.5-2a1 1 0 011.5.9v6.2a1 1 0 01-1.5.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    </div>
    <p className="mb-1 font-semibold text-white">Nothing live right now</p>
    <p className="max-w-sm text-sm text-white/60">Subscribe to creators and their channels will be easy to spot the moment they go live.</p>
    <Link href={signedIn ? "/dashboard" : "/auth"} className="mt-6 text-sm font-semibold text-[#FF1DB4] hover:text-white">
      {signedIn ? "Go to your studio" : "Get started"}
    </Link>
  </div>;
}
export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token ?? null;
  const [liveResult, subscriptionResult, ownChannelResult] = await Promise.all([
    api.get<{ channels: LiveChannel[] }>("/channels/live", { cache: "force-cache", revalidate: 5 }).catch(() => ({ channels: [] })),
    token ? api.get<{ channel_ids: string[] }>("/community/subscriptions", { token }).catch(() => ({ channel_ids: [] })) : Promise.resolve({ channel_ids: [] as string[] }),
    token ? api.get<{ channel: { slug: string } | null }>("/channels/mine", { token }).catch(() => ({ channel: null })) : Promise.resolve({ channel: null }),
  ]);
  const channels = liveResult.channels;
  const subscribedIds = new Set(subscriptionResult.channel_ids);
  const ownSlug = ownChannelResult.channel?.slug ?? null;
  const [featured, ...rest] = channels;
  const cardProps = (item: LiveChannel) => ({ item, token, subscribed: subscribedIds.has(item.channel.id), isOwner: ownSlug === item.channel.slug });

  return <div className="min-h-screen bg-[#11100F]">
    {authSession ? <ConsoleHeader active="explore" /> : <header className="sticky top-0 z-50 border-b border-white/10 bg-[#11100f]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5"><img src="/logo.png" alt="DITCH" className="h-8 w-8 rounded-md" />
          <span className="text-xl font-bold tracking-tight text-[#FF2D93]">DITCH</span></Link>
        <nav className="flex items-center gap-4"><Link href="/auth" className="text-sm font-medium text-white/70 hover:text-white">Sign in</Link>
          <Link href="/auth" className="rounded-md bg-[#D9217F] px-4 py-2 text-sm font-semibold text-white">Get started</Link></nav>
      </div>
    </header>}
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#FF75CD]">Discover live creators</p>
          <h1 className="text-2xl font-bold text-white">Live shows with communities behind them</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">See the stream, recent community conversations, and how many people subscribe before you enter a channel.</p>
        </div>
        {channels.length > 0 && <span className="text-sm text-white/60">{channels.length} {channels.length === 1 ? "channel" : "channels"} streaming now</span>}
      </div>
      {channels.length === 0 ? <EmptyState signedIn={Boolean(authSession)} /> : <div className="space-y-4">
        {featured && <div className={`grid gap-4 ${rest.length >= 2 ? "md:grid-cols-5" : "grid-cols-1"}`}>
          <div className={rest.length >= 2 ? "md:col-span-3" : ""}><FeaturedCard {...cardProps(featured)} /></div>
          {rest.length >= 2 && <div className="grid gap-4 md:col-span-2"><ChannelCard {...cardProps(rest[0])} /><ChannelCard {...cardProps(rest[1])} /></div>}
          {rest.length === 1 && <div className="md:col-span-2"><ChannelCard {...cardProps(rest[0])} /></div>}
        </div>}
        {rest.length > 2 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rest.slice(2).map((item) => <ChannelCard key={item.session_id} {...cardProps(item)} />)}</div>}
      </div>}
    </main>
  </div>;
}
