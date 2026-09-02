import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import type { CommunityPostDetail } from "@ditch/types/src/community";
import CommunityThread from "./CommunityThread";

export default async function CommunityPostPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token ?? null;

  const [detail, channelResult] = await Promise.all([
    api.get<CommunityPostDetail>(`/community/posts/${postId}/detail`, token ? { token } : undefined).catch(() => null),
    api.get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`).catch(() => null),
  ]);

  if (!detail || detail.post.channel_slug !== slug || !channelResult) notFound();
  const activeSession = channelResult.session && channelResult.session.status !== "ended" ? channelResult.session : null;

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/6 px-4 sm:px-6">
        <Link href="/home"><img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" /></Link>
        <span className="text-white/20">/</span>
        <Link href={`/c/${slug}?tab=community`} className="truncate text-sm font-semibold text-white/70">{channelResult.channel.display_name}</Link>
        <span className="text-white/20">/</span>
        <span className="truncate text-xs text-white/35">Community</span>
      </header>
      <CommunityThread initialDetail={detail} token={token ? "cookie-session" : null} activeSessionId={activeSession?.id ?? null} />
    </div>
  );
}
