import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import TransmissionField from "./TransmissionField";

const destinations = [
  { name: "Twitch", code: "TW", tone: "purple", kind: "twitch" },
  { name: "YouTube", code: "YT", tone: "red", kind: "youtube" },
  { name: "TikTok", code: "TK", tone: "cyan", kind: "tiktok" },
  { name: "Kick", code: "KI", tone: "green", kind: "kick" },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <TransmissionField />
      <Header />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} />
              One live room / Every platform
            </div>

            <h1 className={styles.heroTitle}>
              Your stream has
              <span>an audience.</span>
              <em>Give it a door.</em>
            </h1>

            <p className={styles.heroLead}>
              Open one browser studio. Send it to Twitch, YouTube, TikTok, and
              Kick. When someone wants in, cue them onto the broadcast.
            </p>

            <div className={styles.heroActions}>
              <Link href="/auth" className={styles.primaryButton}>
                Start streaming free
                <ArrowIcon />
              </Link>
              <a href="#product" className={styles.secondaryButton}>
                <PlayIcon />
                Step inside the studio
              </a>
            </div>

            <div className={styles.heroProof}>
              <div className={styles.avatarStack} aria-hidden="true">
                <span>J</span>
                <span>A</span>
                <span>M</span>
                <span>+</span>
              </div>
              <p>
                <strong>Free during public beta.</strong>
                <span>Use the browser studio or bring the OBS setup you already trust.</span>
              </p>
            </div>
          </div>

          <SignalGraphic />
        </section>

        <PlatformRail />

        <section className={styles.productSection} id="product">
          <div className={styles.sectionIntro}>
            <div className={styles.sectionMarker}>
              <span>01</span>
              <span>The control room</span>
            </div>
            <div>
              <p className={styles.kicker}>One place to run the whole live.</p>
              <h2>Produce the broadcast, route the signal, and cue the room.</h2>
            </div>
          </div>

          <div className={styles.productProofs}>
            <article className={styles.productProof}>
              <span>TX.01</span>
              <div>
                <h3>Route</h3>
                <p>Connect destinations once. Every output launches together.</p>
              </div>
            </article>
            <article className={styles.productProof}>
              <span>TX.02</span>
              <div>
                <h3>Produce</h3>
                <p>Run camera, mic, screen, and layouts in the browser or OBS.</p>
              </div>
            </article>
            <article className={styles.productProof}>
              <span>RX.01</span>
              <div>
                <h3>Cue</h3>
                <p>Pull a request from chat onto the stage in one move.</p>
              </div>
            </article>
          </div>

          <ControlRoom />
        </section>

        <section className={styles.flywheelSection} id="network">
          <div className={styles.flywheelCopy}>
            <div className={styles.sectionMarker}>
              <span>02</span>
              <span>What changes</span>
            </div>
            <p className={styles.kicker}>Viewers stop being a counter.</p>
            <h2>The live audience becomes the format.</h2>
            <p className={styles.sectionBody}>
              A viewer discovers the show anywhere, enters your DITCH room, and
              steps into the broadcast. The moment they become part of it, the
              show gains a new reason to travel.
            </p>
            <Link href="/auth" className={styles.textLink}>
              Claim your channel <ArrowIcon />
            </Link>
          </div>

          <FlywheelGraphic />
        </section>

        <section className={styles.finalCta} id="start">
          <div className={styles.ctaSignal} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <Image
            src="/logo.png"
            width={72}
            height={72}
            alt=""
            className={styles.ctaLogo}
          />
          <p>Your next great guest is already watching.</p>
          <h2>Open the room.</h2>
          <div className={styles.ctaActions}>
            <Link href="/auth" className={styles.primaryButton}>
              Start streaming free
              <ArrowIcon />
            </Link>
            <span>Free during public beta</span>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.wordmark} aria-label="DITCH home">
          <Image src="/logo.png" width={34} height={34} alt="" priority />
          <span>ditch</span>
        </Link>

        <div className={styles.navLinks}>
          <a href="#product">Product</a>
          <a href="#network">The live loop</a>
          <a href="#start">Public beta</a>
        </div>

        <div className={styles.navActions}>
          <Link href="/auth" className={styles.signIn}>Sign in</Link>
          <Link href="/auth" className={styles.navCta}>
            Get started
            <ArrowIcon />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function SignalGraphic() {
  const tape = [...destinations, ...destinations];

  return (
    <div
      className={styles.signalGraphic}
      role="img"
      aria-label="A kinetic live signal routing from DITCH to Twitch, YouTube, TikTok and Kick"
    >
      <div className={styles.signalFilm}>
        <div className={styles.filmGrid} aria-hidden="true" />
        <div className={styles.signalNoise} aria-hidden="true" />
        <div className={styles.filmWipe} aria-hidden="true" />

        <div className={styles.filmTimecode}>
          <span><i /> Live transmission</span>
          <b>DITCH / 01:42:08:19</b>
        </div>

        <div className={styles.kineticWords} aria-hidden="true">
          <span>LIVE</span>
          <span>SEND</span>
          <span>4X</span>
        </div>

        <svg className={styles.routeField} viewBox="0 0 760 660" aria-hidden="true">
          <defs>
            <linearGradient id="route-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff1db4" />
              <stop offset=".55" stopColor="#ff65d0" />
              <stop offset="1" stopColor="#00d4aa" />
            </linearGradient>
          </defs>
          <g className={styles.routeBase}>
            <path d="M88 352 H278 L420 150 H742" />
            <path d="M88 352 H304 L442 206 H742" />
            <path d="M88 352 H304 L442 262 H742" />
            <path d="M88 352 H278 L420 318 H742" />
          </g>
          <g className={styles.routeBurst}>
            <path d="M88 352 H278 L420 150 H742" pathLength="100" />
            <path d="M88 352 H304 L442 206 H742" pathLength="100" />
            <path d="M88 352 H304 L442 262 H742" pathLength="100" />
            <path d="M88 352 H278 L420 318 H742" pathLength="100" />
          </g>
        </svg>

        <div className={styles.originBlock}>
          <Image src="/logo.png" width={54} height={54} alt="" />
          <div>
            <small>Ditch origin</small>
            <strong>One signal<br />Open room</strong>
          </div>
          <span><i /> On air</span>
        </div>

        <div className={styles.destinationStack}>
          <div className={styles.stackHeader}>
            <span>Signal fan-out</span>
            <b>04 / 04 live</b>
          </div>
          {destinations.map((destination, index) => (
            <div
              className={styles.signalLane}
              key={destination.name}
              style={{ "--lane-delay": `${index * 140}ms` } as CSSProperties}
            >
              <span className={`${styles.laneIcon} ${styles[destination.tone]}`}>
                <PlatformIcon kind={destination.kind} />
              </span>
              <strong>{destination.name}</strong>
              <small>1080P / 30</small>
              <b><i /> Live</b>
            </div>
          ))}
        </div>

        <div className={styles.audienceReturn}>
          <span>Audience return path</span>
          <div>
            <b>Watch</b>
            <i aria-hidden="true">-&gt;</i>
            <b>Request</b>
            <i aria-hidden="true">-&gt;</i>
            <b>On screen</b>
          </div>
          <small>Platform viewer enters the DITCH room</small>
        </div>

        <div className={styles.cutSequence} aria-hidden="true">
          <span>Input 01</span>
          <b>Creator feed locked</b>
          <i />
          <b>Participant channel armed</b>
          <span>8.4 Mbps</span>
        </div>

        <div className={styles.filmTicker} aria-hidden="true">
          <div>
            {tape.map((destination, index) => (
              <span key={`${destination.name}-${index}`}>
                {destination.name} <b>Live</b> / signal locked
              </span>
            ))}
          </div>
        </div>

        <div className={styles.frameCorners} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function PlatformRail() {
  const items = [...destinations, ...destinations];
  return (
    <section className={styles.platformRail} aria-label="Supported streaming destinations">
      <div className={styles.railLabel}>One signal</div>
      <div className={styles.railWindow}>
        <div className={styles.railTrack}>
          {items.map((destination, index) => (
            <span key={`${destination.name}-${index}`}>
              <i className={`${styles.railPlatformIcon} ${styles[destination.tone]}`}>
                <PlatformIcon kind={destination.kind} />
              </i>
              {destination.name}
              <b>LIVE</b>
            </span>
          ))}
        </div>
      </div>
      <div className={styles.railLabel}>Everywhere</div>
    </section>
  );
}

function ControlRoom() {
  return (
    <div className={styles.controlRoom}>
      <div className={styles.controlTopbar}>
        <div className={styles.controlWordmark}>
          <Image src="/logo.png" width={24} height={24} alt="" />
          <span>ditch</span>
          <b>LIVE STUDIO</b>
        </div>
        <div className={styles.controlStatus}>
          <i /> All systems live <span>01:42:08</span>
        </div>
      </div>

      <div className={styles.controlBody}>
        <div className={styles.controlSidebar}>
          <span className={styles.sidebarActive}><GridIcon /> Studio</span>
          <span><SignalIcon /> Destinations</span>
          <span><PeopleIcon /> Participants <b>3</b></span>
          <span><ChatIcon /> Unified chat</span>
          <div className={styles.sidebarUser}><i>JL</i><p>Jules Live<small>@jules</small></p></div>
        </div>

        <div className={styles.controlCanvas}>
          <div className={styles.canvasHeader}>
            <div><small>BROADCAST PREVIEW</small><strong>After Hours: Open Room</strong></div>
            <button type="button" tabIndex={-1}><i /> End stream</button>
          </div>
          <div className={styles.previewStage}>
            <div className={styles.previewHost}><span>JL</span><small>Jules</small></div>
            <div className={styles.previewGuest}><span>AM</span><small>Amara</small></div>
            <div className={styles.previewLive}>LIVE</div>
            <div className={styles.previewBrand}>ditch / AFTER HOURS</div>
          </div>
          <div className={styles.controlsRow}>
            <span><MicIcon /> Mic</span>
            <span><CameraIcon /> Camera</span>
            <span><ScreenIcon /> Share</span>
            <span><SparkIcon /> Layout</span>
          </div>
          <div className={styles.destinationStrip}>
            <div><small>DESTINATIONS</small><strong>4 connected</strong></div>
            {destinations.map((destination) => (
              <span key={destination.name}><i className={styles[destination.tone]} />{destination.name}<b>LIVE</b></span>
            ))}
          </div>
        </div>

        <div className={styles.controlPanel}>
          <div className={styles.panelTabs}><b>Guests <span>3</span></b><span>Chat</span></div>
          <div className={styles.queueLabel}>REQUESTING TO JOIN</div>
          <div className={styles.queueCard}>
            <i className={styles.queueAvatar}>KA</i>
            <p><strong>Kai Abrams</strong><small>from YouTube</small></p>
            <button type="button" tabIndex={-1}>Cue in</button>
          </div>
          <div className={styles.queueCard}>
            <i className={`${styles.queueAvatar} ${styles.queueAvatarTwo}`}>SO</i>
            <p><strong>Sol O.</strong><small>from DITCH</small></p>
            <button type="button" tabIndex={-1}>Cue in</button>
          </div>
          <div className={styles.queueLabel}>ON STAGE</div>
          <div className={styles.onStageCard}>
            <i>AM</i><p><strong>Amara Mills</strong><small><span /> On air</small></p><b>•••</b>
          </div>
          <div className={styles.chatPreview}>
            <div><i className={styles.purple} /><p><strong>mina_live</strong><span>this format is wild</span></p></div>
            <div><i className={styles.red} /><p><strong>kai.a</strong><span>let me in 👀</span></p></div>
            <div><i className={styles.cyan} /><p><strong>solonline</strong><span>we are everywhere</span></p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlywheelGraphic() {
  return (
    <div className={styles.flywheel} aria-label="The DITCH audience growth loop">
      <div className={styles.orbit} aria-hidden="true">
        <span className={styles.orbitPulse} />
        <span className={styles.orbitPulseTwo} />
      </div>
      <div className={styles.flywheelCenter}>
        <Image src="/logo.png" width={72} height={72} alt="" />
        <strong>DITCH</strong>
        <span>LIVE ROOM</span>
      </div>
      <div className={`${styles.loopStep} ${styles.loopOne}`}>
        <b>01</b><span><strong>Discover</strong><small>Find the show anywhere</small></span>
      </div>
      <div className={`${styles.loopStep} ${styles.loopTwo}`}>
        <b>02</b><span><strong>Enter</strong><small>Move into the live room</small></span>
      </div>
      <div className={`${styles.loopStep} ${styles.loopThree}`}>
        <b>03</b><span><strong>Participate</strong><small>Step onto the broadcast</small></span>
      </div>
      <div className={`${styles.loopStep} ${styles.loopFour}`}>
        <b>04</b><span><strong>Amplify</strong><small>Give others a reason to join</small></span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <Link href="/" className={styles.wordmark} aria-label="DITCH home">
          <Image src="/logo.png" width={34} height={34} alt="" />
          <span>ditch</span>
        </Link>
        <p>One room. Every audience.</p>
        <nav aria-label="Footer navigation">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:sendmailtodex@gmail.com">Contact</a>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>DITCH, Rome</span>
        <span>© 2026 DITCH. All rights reserved.</span>
      </div>
    </footer>
  );
}

function PlatformIcon({ kind }: { kind: "twitch" | "youtube" | "tiktok" | "kick" }) {
  if (kind === "youtube") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="m10 9 5 3-5 3Z" fill="#fff" /></svg>;
  }
  if (kind === "tiktok") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3v10.3a4.7 4.7 0 1 1-4-4.6v2.8a2 2 0 1 0 1.2 1.8V3h2.8Zm0 0c.5 2.3 1.8 3.7 4.3 4.1V10a8.2 8.2 0 0 1-4.3-1.8" fill="currentColor" /></svg>;
  }
  if (kind === "kick") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h5v5h2V7h2V4h7v6h-3v4h3v6h-7v-3h-2v-2H9v5H4V4Z" fill="currentColor" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h17v12l-5 5h-4l-3 3v-3H4V3Zm3 3v10h4v2l2-2h4l2-2V6H7Zm4 2h2v5h-2V8Zm4 0h2v5h-2V8Z" fill="currentColor" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="m8.5 7 4.5 3-4.5 3V7Z" fill="currentColor" /></svg>;
}

function MicIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2" width="6" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function CameraIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m13 8 5-2v8l-5-2V8Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

function GridIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="6" height="6" rx="1" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" /></svg>;
}

function SignalIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.5 19.5a10.6 10.6 0 0 1 0-15M19.5 4.5a10.6 10.6 0 0 1 0 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function PeopleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.3a3 3 0 0 1 0 5.4M16.5 14.5a5.2 5.2 0 0 1 4 5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H9l-5 4V5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function ScreenIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="16" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7 18h6M10 14v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 5.7 3.3 8.4 9 9-5.7.6-8.4 3.3-9 9-.6-5.7-3.3-8.4-9-9 5.7-.6 8.4-3.3 9-9Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M19 2c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z" fill="currentColor" /></svg>;
}
