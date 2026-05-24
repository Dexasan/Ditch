import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";

type StreamPlatform = "twitch" | "youtube" | "tiktok" | "kick";

type LiveChannel = {
  session_id: string;
  live_since: string;
  channel: {
    id: string;
    slug: string;
    display_name: string;
    description: string | null;
  };
  platforms: StreamPlatform[];
  on_screen: number;
};

const PLATFORM_CONFIG: Record<StreamPlatform, { label: string; color: string; bg: string }> = {
  twitch:  { label: "Twitch",  color: "#9146FF", bg: "rgba(145,70,255,0.18)" },
  youtube: { label: "YouTube", color: "#FF4444", bg: "rgba(255,68,68,0.18)" },
  tiktok:  { label: "TikTok",  color: "#00E5D4", bg: "rgba(0,229,212,0.18)" },
  kick:    { label: "Kick",    color: "#53FC18", bg: "rgba(83,252,24,0.18)" },
};

// Deterministic gradient from channel slug — unique per creator, consistent across renders
function channelGradient(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(145deg, hsl(${h1},55%,7%) 0%, hsl(${h2},45%,14%) 60%, hsl(${h1},60%,9%) 100%)`;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
      style={{ background: "rgba(255,29,180,0.15)", color: "#FF1DB4", border: "1px solid rgba(255,29,180,0.3)" }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#FF1DB4] animate-pulse" />
      Live
    </span>
  );
}

function PlatformPills({ platforms }: { platforms: StreamPlatform[] }) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map((p) => {
        const cfg = PLATFORM_CONFIG[p];
        if (!cfg) return null;
        return (
          <span key={p}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// Large featured card (first live channel)
function FeaturedCard({ item }: { item: LiveChannel }) {
  const gradient = channelGradient(item.channel.slug);
  return (
    <Link href={`/c/${item.channel.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
      style={{ background: gradient, border: "1px solid rgba(255,255,255,0.06)" }}>

      {/* Animated glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ boxShadow: "inset 0 0 60px rgba(255,29,180,0.08)" }} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <LiveBadge />
        {item.on_screen > 0 && (
          <span className="text-xs text-white/50 font-medium">
            {item.on_screen} on screen
          </span>
        )}
      </div>

      {/* Center: channel identity */}
      <div className="flex-1 flex flex-col items-start justify-center px-5 py-10">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-xl font-black text-white"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {item.channel.display_name[0].toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1 leading-tight">{item.channel.display_name}</h2>
        <p className="text-sm text-white/45 leading-snug line-clamp-2 max-w-xs">
          {item.channel.description ?? "Broadcasting live on DITCH"}
        </p>
      </div>

      {/* Bottom: platforms + CTA */}
      <div className="px-5 pb-5 pt-2 flex items-end justify-between gap-3 border-t border-white/5">
        <div className="space-y-2">
          {item.platforms.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Also streaming on</p>
          )}
          <PlatformPills platforms={item.platforms} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-[#FF1DB4] opacity-0 group-hover:opacity-100 transition-opacity">
          Watch →
        </span>
      </div>
    </Link>
  );
}

// Smaller card for the grid
function ChannelCard({ item }: { item: LiveChannel }) {
  const gradient = channelGradient(item.channel.slug);
  return (
    <Link href={`/c/${item.channel.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
      style={{ background: gradient, border: "1px solid rgba(255,255,255,0.06)" }}>

      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
        style={{ boxShadow: "inset 0 0 40px rgba(255,29,180,0.07)" }} />

      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <LiveBadge />
        {item.on_screen > 0 && (
          <span className="text-[11px] text-white/40 font-medium">{item.on_screen} on screen</span>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 py-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 text-base font-black text-white"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {item.channel.display_name[0].toUpperCase()}
        </div>
        <h3 className="text-lg font-bold text-white mb-0.5 leading-tight">{item.channel.display_name}</h3>
        <p className="text-xs text-white/40 line-clamp-1">
          {item.channel.description ?? "Broadcasting live"}
        </p>
      </div>

      <div className="px-4 pb-4 pt-1 border-t border-white/5">
        {item.platforms.length > 0 ? (
          <PlatformPills platforms={item.platforms} />
        ) : (
          <span className="text-[11px] text-white/25">DITCH only</span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(255,29,180,0.07)", border: "1px solid rgba(255,29,180,0.12)" }}>
        <svg className="w-7 h-7 text-[#FF1DB4] opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
      </div>
      <p className="text-white font-semibold mb-1">Nothing live right now</p>
      <p className="text-sm text-white/40 max-w-xs">
        Be the first to go live. Channels you follow will appear here when they&apos;re streaming.
      </p>
      <Link href="/dashboard"
        className="mt-6 text-sm font-semibold text-[#FF1DB4] hover:text-white transition-colors">
        Go to your studio →
      </Link>
    </div>
  );
}

export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();

  const { channels } = await api
    .get<{ channels: LiveChannel[] }>("/channels/live")
    .catch(() => ({ channels: [] }));

  const [featured, ...rest] = channels;

  return (
    <div className="min-h-screen" style={{ background: "#080810" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-md"
        style={{ background: "rgba(8,8,16,0.85)" }}>
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" />
              <span className="text-lg font-bold tracking-tight text-[#FF1DB4]">DITCH</span>
            </Link>
            <span className="text-white/20 text-sm hidden sm:block">Explore</span>
          </div>
          <nav className="flex items-center gap-4">
            {authSession ? (
              <Link href="/dashboard"
                className="text-sm font-medium text-white/50 hover:text-white transition-colors">
                Studio
              </Link>
            ) : (
              <>
                <Link href="/auth"
                  className="text-sm font-medium text-white/50 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link href="/auth"
                  className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors text-white"
                  style={{ background: "#FF1DB4" }}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Section heading */}
        <div className="mb-8 flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-white">What&apos;s Live</h1>
          {channels.length > 0 && (
            <span className="text-sm text-white/35 font-medium">
              {channels.length} {channels.length === 1 ? "channel" : "channels"} streaming now
            </span>
          )}
        </div>

        {channels.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {/* Magazine layout: featured (large) + 2 stacked cards side by side */}
            {featured && (
              <div className={`grid gap-4 ${rest.length >= 2 ? "md:grid-cols-5" : "grid-cols-1"}`}>
                {/* Featured card spans 3 of 5 columns */}
                <div className={rest.length >= 2 ? "md:col-span-3" : ""} style={{ minHeight: "320px" }}>
                  <FeaturedCard item={featured} />
                </div>

                {/* Two stacked smaller cards */}
                {rest.length >= 2 && (
                  <div className="md:col-span-2 grid grid-cols-1 gap-4" style={{ minHeight: "320px" }}>
                    <ChannelCard item={rest[0]} />
                    <ChannelCard item={rest[1]} />
                  </div>
                )}

                {/* If only 1 extra, show it full width below */}
                {rest.length === 1 && (
                  <div className="md:col-span-2" style={{ minHeight: "320px" }}>
                    <ChannelCard item={rest[0]} />
                  </div>
                )}
              </div>
            )}

            {/* Remaining channels in 3-column grid */}
            {rest.length > 2 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.slice(2).map((item) => (
                  <div key={item.session_id} style={{ minHeight: "220px" }}>
                    <ChannelCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
