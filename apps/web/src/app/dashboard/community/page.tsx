import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import type { CommunityPostV2 } from "@ditch/types/src/community";
import ConsoleHeader from "@/components/ConsoleHeader";
import CreatorCommunityInbox from "./CreatorCommunityInbox";

export default async function CreatorCommunityPage() {
  const supabase = await createClient();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) redirect("/auth");
  const token = authSession.access_token;

  const { channel } = await api.get<{ channel: Channel | null }>("/channels/mine", { token });
  if (!channel) redirect("/onboarding");

  const [{ posts }, channelState] = await Promise.all([
    api.get<{ posts: CommunityPostV2[] }>("/channels/mine/community-inbox", { token }).catch(() => ({ posts: [] })),
    api.get<{ channel: Channel; session: LiveSession | null }>(`/channels/${channel.slug}`).catch(() => ({ channel, session: null })),
  ]);
  const activeSession = channelState.session && channelState.session.status !== "ended" ? channelState.session : null;

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <ConsoleHeader active="community" channelSlug={channel.slug} liveControlHref={activeSession ? `/c/${channel.slug}/live` : undefined} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF75CD]">Community inbox</p><h1 className="mt-2 text-3xl font-bold">Turn audience signal into the show.</h1><p className="mt-2 text-sm text-white/40">Respond, move Ideas forward, and add planned contributions to the active rundown.</p></div>
          <Link href={`/c/${channel.slug}?tab=community`} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/55 hover:text-white">View public board</Link>
        </div>
        {!activeSession && <div className="mb-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100/60">Start a session before adding Ideas to a show rundown.</div>}
        <CreatorCommunityInbox channelSlug={channel.slug} token={token} initialPosts={posts} activeSessionId={activeSession?.id ?? null} />
      </main>
    </div>
  );
}
