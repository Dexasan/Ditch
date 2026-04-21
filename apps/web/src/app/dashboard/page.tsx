import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession, StreamDestination } from "@ditch/types";
import SessionPanel from "./SessionPanel";
import DestinationList from "./DestinationList";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");

  const token = session.access_token;

  // Guard: no channel → onboarding
  const { channel } = await api.get<{ channel: Channel | null }>("/channels/mine", { token });
  if (!channel) redirect("/onboarding");

  // Get active session + destinations in parallel
  const [{ session: liveSession }, { destinations }] = await Promise.all([
    api.get<{ session: LiveSession | null; channel: Channel }>(`/channels/${channel.slug}`).then(
      (r) => ({ session: r.session })
    ),
    api
      .get<{ destinations: StreamDestination[] }>(`/destinations?channel_id=${channel.id}`, { token })
      .catch(() => ({ destinations: [] as StreamDestination[] })),
  ]);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--color-surface-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight">DITCH</span>
          <span className="text-[var(--color-text-muted)] text-sm">/</span>
          <span className="text-sm text-[var(--color-text-muted)]">{channel.slug}</span>
        </div>
        <div className="flex items-center gap-4">
          {liveSession && liveSession.status !== "ended" && (
            <a
              href={`/c/${channel.slug}/live`}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-xs font-semibold transition-colors"
            >
              Control room →
            </a>
          )}
          <SignOutButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{channel.display_name}</h1>
          {channel.description && (
            <p className="text-[var(--color-text-muted)] text-sm mt-1">{channel.description}</p>
          )}
        </div>

        <SessionPanel
          channelId={channel.id}
          channelSlug={channel.slug}
          initialSession={liveSession ?? null}
        />

        {liveSession && liveSession.status !== "ended" && (
          <DestinationList
            sessionId={liveSession.id}
            initialDestinations={destinations}
          />
        )}
      </main>
    </div>
  );
}
