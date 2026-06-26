import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession, CommunityPost } from "@ditch/types";
import SessionPanel from "./SessionPanel";
import DestinationList, { type SavedDestination } from "./DestinationList";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");

  const token = session.access_token;

  // Guard: no channel → onboarding
  const { channel } = await api.get<{ channel: Channel | null }>("/channels/mine", { token });
  if (!channel) redirect("/onboarding");

  // Get active session, saved destinations, and top suggestions in parallel
  const [{ session: liveSession }, { saved_destinations }, { suggestions }] = await Promise.all([
    api.get<{ session: LiveSession | null; channel: Channel }>(`/channels/${channel.slug}`).then(
      (r) => ({ session: r.session })
    ),
    api
      .get<{ saved_destinations: SavedDestination[] }>(`/saved-destinations?channel_id=${channel.id}`, { token })
      .catch(() => ({ saved_destinations: [] as SavedDestination[] })),
    api
      .get<{ suggestions: CommunityPost[] }>("/channels/mine/suggestions", { token })
      .catch(() => ({ suggestions: [] as CommunityPost[] })),
  ]);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--color-surface-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" />
          <span className="text-[var(--color-text-muted)] text-sm">/</span>
          <a
            href={`/c/${channel.slug}`}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {channel.slug}
          </a>
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

        <DestinationList
          channelId={channel.id}
          initialDestinations={saved_destinations}
        />

        {/* Top suggestions from your community */}
        {suggestions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Top suggestions</h2>
              <a
                href={`/c/${channel.slug}?tab=community`}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand)] transition-colors"
              >
                View all →
              </a>
            </div>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-surface-border)" }}
                >
                  <span
                    className="text-sm font-bold tabular-nums min-w-[2rem] text-center"
                    style={{ color: "var(--color-brand)" }}
                  >
                    {s.vote_count}
                  </span>
                  <p className="text-sm text-[var(--color-text)] flex-1 line-clamp-1">{s.title}</p>
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                    {s.author_display_name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
