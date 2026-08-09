import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession, CommunityPost } from "@ditch/types";
import ConsoleHeader from "@/components/ConsoleHeader";
import SessionConsole from "./SessionConsole";
import DestinationConsole, { type SavedDestination } from "./DestinationConsole";
import styles from "./dashboard.module.css";

export default async function DashboardExperience() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");

  const token = session.access_token;
  const {
    channel,
    session: liveSession,
    saved_destinations,
    suggestions,
  } = await api.get<{
    channel: Channel | null;
    session: LiveSession | null;
    saved_destinations: SavedDestination[];
    suggestions: CommunityPost[];
    unread_notifications: number;
  }>("/console/bootstrap", { token });

  if (!channel) redirect("/onboarding");

  const isLive = Boolean(liveSession && liveSession.status !== "ended");
  const usesBrowserStudio = liveSession?.source_type !== "rtmp";
  const channelInitial = channel.display_name.trim().charAt(0).toUpperCase() || "D";

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGrid} aria-hidden="true" />
      <ConsoleHeader
        active="studio"
        channelSlug={channel.slug}
        liveControlHref={isLive && usesBrowserStudio ? `/c/${channel.slug}/live` : undefined}
      />

      <main className={styles.main}>
        <aside className={styles.rail}>
          <div className={styles.channelCard}>
            <div className={styles.channelAvatar}>{channelInitial}</div>
            <p>CHANNEL / PRIMARY</p>
            <h2>{channel.display_name}</h2>
            <Link href={`/c/${channel.slug}`}>ditchlive.app/c/{channel.slug}</Link>
          </div>

          <nav className={styles.railNav} aria-label="Studio setup sections">
            <a href="#session" className={styles.railLink}>
              <span>01</span>
              <div><strong>Broadcast</strong><small>Session control</small></div>
            </a>
            <a href="#destinations" className={styles.railLink}>
              <span>02</span>
              <div><strong>Destinations</strong><small>Signal outputs</small></div>
            </a>
            <a href="#community" className={styles.railLink}>
              <span>03</span>
              <div><strong>Community</strong><small>Audience requests</small></div>
            </a>
          </nav>

          <div className={styles.railStatus}>
            <div className={styles.railStatusTop}>
              <span>SYSTEM STATUS</span>
              <b>{isLive ? "ON AIR" : "READY"}</b>
            </div>
            <div className={styles.statusRow}><i /> Browser studio <b>Online</b></div>
            <div className={styles.statusRow}><i /> Audience return <b>Armed</b></div>
            <div className={styles.statusRow}><i /> Outputs <b>{saved_destinations.length.toString().padStart(2, "0")}</b></div>
          </div>
        </aside>

        <section className={styles.workspace}>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}><span>STUDIO DESK</span><i /> PRE-FLIGHT / CHANNEL 01</p>
              <h1>Build the broadcast.</h1>
              <p>{channel.description || "Configure the room, arm your outputs, and take the show live."}</p>
            </div>
            <div className={styles.heroActions}>
              <Link href={`/c/${channel.slug}`} className={styles.secondaryLink}>
                View public room
                <ExternalIcon />
              </Link>
              {isLive && usesBrowserStudio && (
                <Link href={`/c/${channel.slug}/live`} className={styles.primaryLink}>
                  Enter control room
                  <ArrowIcon />
                </Link>
              )}
            </div>
          </header>

          <div className={styles.controlGrid}>
            <div id="session">
              <SessionConsole
                channelId={channel.id}
                channelSlug={channel.slug}
                initialSession={liveSession ?? null}
                token={token}
              />
            </div>
            <div id="destinations">
              <DestinationConsole
                channelId={channel.id}
                initialDestinations={saved_destinations}
                token={token}
              />
            </div>
          </div>

          <section className={styles.communityPanel} id="community">
            <div className={styles.communityHeader}>
              <div>
                <p>03 / AUDIENCE RETURN</p>
                <h2>Community signal</h2>
              </div>
              <Link href={`/c/${channel.slug}?tab=community`}>
                Open community
                <ArrowIcon />
              </Link>
            </div>

            {suggestions.length > 0 ? (
              <div className={styles.suggestions}>
                {suggestions.map((suggestion, index) => (
                  <article key={suggestion.id} className={styles.suggestion}>
                    <span>{(index + 1).toString().padStart(2, "0")}</span>
                    <div>
                      <h3>{suggestion.title}</h3>
                      <p>From {suggestion.author_display_name}</p>
                    </div>
                    <b>{suggestion.vote_count}<small>votes</small></b>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyCommunity}>
                <div className={styles.rings} aria-hidden="true"><i /><i /><span /></div>
                <div>
                  <h3>The return channel is quiet.</h3>
                  <p>Ideas and requests from your community will land here.</p>
                </div>
              </div>
            )}
          </section>

          <footer className={styles.telemetry}>
            <span><i /> DITCH network online</span>
            <span>{channel.slug.toUpperCase()} / CONTROL DESK</span>
            <span>Browser studio / Global output</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h13M10 4l5 5-5 5" /></svg>;
}

function ExternalIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4H4v10h10v-3M9 3h6v6M8 10l7-7" /></svg>;
}
