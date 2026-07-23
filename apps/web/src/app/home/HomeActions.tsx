import Link from "next/link";
import styles from "./home.module.css";

const PLATFORMS = [
  { label: "Twitch", code: "TW", className: styles.twitch },
  { label: "YouTube", code: "YT", className: styles.youtube },
  { label: "TikTok", code: "TK", className: styles.tiktok },
  { label: "Kick", code: "KI", className: styles.kick },
] as const;

export default function HomeActions() {
  return (
    <section className={styles.cards} aria-label="Choose a DITCH experience">
      <Link href="/dashboard" className={`${styles.actionCard} ${styles.studioCard}`}>
        <div className={styles.cardChrome}>
          <span><i className={styles.recordLamp} /> Studio floor</span>
          <b>TX / 01</b>
        </div>

        <div className={styles.studioArt} aria-hidden="true">
          <div className={styles.preview}>
            <div className={styles.previewNoise} />
            <span className={styles.previewLive}>READY</span>
            <div className={styles.previewSubject}>
              <i />
              <b>YOU</b>
            </div>
            <div className={styles.previewLowerThird}>
              <span>DITCH / YOUR SHOW</span>
              <b>16:9</b>
            </div>
            <div className={styles.previewCorners}><i /><i /><i /><i /></div>
          </div>
          <div className={styles.consoleStrip}>
            <div>
              <small>INPUT</small>
              <span><i /> Camera</span>
            </div>
            <div>
              <small>AUDIO</small>
              <span className={styles.equalizer}>
                {Array.from({ length: 12 }).map((_, index) => <i key={index} />)}
              </span>
            </div>
            <div>
              <small>OUTPUTS</small>
              <strong>04 armed</strong>
            </div>
          </div>
        </div>

        <div className={styles.cardCopy}>
          <div>
            <p>GO LIVE / BUILD THE SHOW</p>
            <h2>Open your studio.</h2>
            <span>Route the signal, cue guests, and take the room on air.</span>
          </div>
          <ArrowBadge />
        </div>
      </Link>

      <Link href="/explore" className={`${styles.actionCard} ${styles.exploreCard}`}>
        <div className={styles.cardChrome}>
          <span><i className={styles.mintLamp} /> Audience return</span>
          <b>RX / 02</b>
        </div>

        <div className={styles.radar} aria-hidden="true">
          <div className={styles.radarGrid} />
          <div className={styles.radarSweep} />
          <div className={styles.radarCore}>
            <span>LIVE</span>
            <b>ROOMS</b>
          </div>
          {PLATFORMS.map((platform) => (
            <span
              key={platform.code}
              className={`${styles.platformNode} ${platform.className}`}
            >
              {platform.code}
              <small>{platform.label}</small>
            </span>
          ))}
        </div>

        <div className={styles.cardCopy}>
          <div>
            <p>WATCH / ENTER THE LOOP</p>
            <h2>See what&apos;s live.</h2>
            <span>Find a room, join the chat, and become part of the show.</span>
          </div>
          <ArrowBadge />
        </div>
      </Link>
    </section>
  );
}

function ArrowBadge() {
  return (
    <span className={styles.arrowBadge} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
