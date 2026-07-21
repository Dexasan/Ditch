import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const destinations = [
  { name: "Twitch", code: "TW", tone: "purple" },
  { name: "YouTube", code: "YT", tone: "red" },
  { name: "TikTok", code: "TK", tone: "cyan" },
  { name: "Kick", code: "KI", tone: "green" },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <Header />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} />
              The participatory broadcast network
            </div>

            <h1 className={styles.heroTitle}>
              One live show.
              <span>Every audience.</span>
              <em>Anyone can step in.</em>
            </h1>

            <p className={styles.heroLead}>
              DITCH sends one broadcast everywhere, then turns viewers from any
              platform into people on the show. One room becomes a network.
            </p>

            <div className={styles.heroActions}>
              <Link href="/auth" className={styles.primaryButton}>
                Claim your channel
                <ArrowIcon />
              </Link>
              <a href="#product" className={styles.secondaryButton}>
                <PlayIcon />
                See the signal flow
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
                <strong>Built for participation.</strong>
                <span>From first click to on-screen in one live room.</span>
              </p>
            </div>
          </div>

          <SignalGraphic />
        </section>

        <PlatformRail />

        <section className={styles.manifesto} id="why">
          <div className={styles.sectionMarker}>
            <span>01</span>
            <span>Why DITCH</span>
          </div>
          <div className={styles.manifestoCopy}>
            <p className={styles.kicker}>The old live model is a dead end.</p>
            <h2>
              Streaming made everyone a viewer.
              <span> DITCH turns the audience into the show.</span>
            </h2>
            <div className={styles.manifestoDetails}>
              <p>
                Audiences are fragmented across platforms. Creators perform into
                four separate rooms. Participation stops at the comment box.
              </p>
              <p>
                DITCH changes the shape of live media: one origin, every
                destination, and a direct path from watching to being seen.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.productSection} id="product">
          <div className={styles.sectionIntro}>
            <div className={styles.sectionMarker}>
              <span>02</span>
              <span>Inside the product</span>
            </div>
            <div>
              <p className={styles.kicker}>The whole live stack. One browser.</p>
              <h2>Your control room for the open internet.</h2>
            </div>
          </div>

          <ControlRoom />
        </section>

        <section className={styles.flywheelSection} id="network">
          <div className={styles.flywheelCopy}>
            <div className={styles.sectionMarker}>
              <span>03</span>
              <span>The network effect</span>
            </div>
            <p className={styles.kicker}>Every participant is distribution.</p>
            <h2>The audience acquisition loop built into the show.</h2>
            <p className={styles.sectionBody}>
              A viewer discovers the stream anywhere, moves into the DITCH room,
              joins the broadcast, and gives the next wave of viewers a reason to
              follow. The format carries its own growth.
            </p>
            <Link href="/auth" className={styles.textLink}>
              Start the loop <ArrowIcon />
            </Link>
          </div>

          <FlywheelGraphic />
        </section>

        <section className={styles.layersSection}>
          <div className={styles.sectionIntro}>
            <div className={styles.sectionMarker}>
              <span>04</span>
              <span>The platform</span>
            </div>
            <div>
              <p className={styles.kicker}>More than multistreaming.</p>
              <h2>Three layers. One category-defining product.</h2>
            </div>
          </div>

          <div className={styles.layerGrid}>
            <article className={`${styles.layerCard} ${styles.distributionCard}`}>
              <div className={styles.layerNumber}>01</div>
              <SignalIcon />
              <div className={styles.layerContent}>
                <p>Distribution</p>
                <h3>Go live once. Be everywhere.</h3>
                <span>
                  One high-quality source becomes a native broadcast across every
                  major platform.
                </span>
              </div>
              <div className={styles.miniDestinations} aria-hidden="true">
                {destinations.map((destination, index) => (
                  <span
                    key={destination.code}
                    style={{
                      "--offset": `${(index - 1) * 8}px`,
                      "--delay": `${index * -800}ms`,
                    } as CSSProperties}
                  >
                    {destination.code}
                  </span>
                ))}
              </div>
            </article>

            <article className={`${styles.layerCard} ${styles.participationCard}`}>
              <div className={styles.layerNumber}>02</div>
              <PeopleIcon />
              <div className={styles.layerContent}>
                <p>Participation</p>
                <h3>Turn viewers into co-stars.</h3>
                <span>
                  Approve a request and bring anyone on screen across every
                  destination at the same time.
                </span>
              </div>
              <div className={styles.participantPreview} aria-hidden="true">
                <div><span>JL</span><small>Host</small></div>
                <div><span>AM</span><small>Guest</small></div>
                <b>ON AIR</b>
              </div>
            </article>

            <article className={`${styles.layerCard} ${styles.networkCard}`}>
              <div className={styles.layerNumber}>03</div>
              <SparkIcon />
              <div className={styles.layerContent}>
                <p>Network</p>
                <h3>Make the moment the media.</h3>
                <span>
                  Participatory formats create culture, distribution, and new
                  surfaces for brands in one motion.
                </span>
              </div>
              <div className={styles.networkRings} aria-hidden="true">
                <i />
                <i />
                <span>DITCH</span>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.finalCta}>
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
          <p>Broadcasting is becoming participatory.</p>
          <h2>Build the room everyone wants to be in.</h2>
          <div className={styles.ctaActions}>
            <Link href="/auth" className={styles.primaryButton}>
              Claim your channel
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
          <a href="#network">Network effect</a>
          <a href="#why">Why DITCH</a>
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
  return (
    <div className={styles.signalGraphic} aria-label="A DITCH live room broadcasting to Twitch, YouTube, TikTok and Kick">
      <div className={styles.signalHalo} aria-hidden="true" />
      <svg className={styles.signalMap} viewBox="0 0 700 660" aria-hidden="true">
        <defs>
          <linearGradient id="signal-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff1db4" />
            <stop offset="1" stopColor="#00d4aa" />
          </linearGradient>
          <filter id="signal-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className={styles.signalTrack} d="M350 132 C232 132 170 137 91 198" />
        <path className={styles.signalTrack} d="M350 132 C470 132 532 136 610 198" />
        <path className={styles.signalTrack} d="M350 490 C224 490 166 504 90 568" />
        <path className={styles.signalTrack} d="M350 490 C474 490 535 506 611 568" />
        <path className={styles.signalPulse} d="M350 132 C232 132 170 137 91 198" />
        <path className={styles.signalPulse} d="M350 132 C470 132 532 136 610 198" />
        <path className={styles.signalPulse} d="M350 490 C224 490 166 504 90 568" />
        <path className={styles.signalPulse} d="M350 490 C474 490 535 506 611 568" />
      </svg>

      <div className={`${styles.platformNode} ${styles.twitchNode}`}>
        <PlatformIcon kind="twitch" />
        <span><strong>Twitch</strong><small>Live</small></span>
        <i />
      </div>
      <div className={`${styles.platformNode} ${styles.youtubeNode}`}>
        <PlatformIcon kind="youtube" />
        <span><strong>YouTube</strong><small>Live</small></span>
        <i />
      </div>
      <div className={`${styles.platformNode} ${styles.tiktokNode}`}>
        <PlatformIcon kind="tiktok" />
        <span><strong>TikTok</strong><small>Live</small></span>
        <i />
      </div>
      <div className={`${styles.platformNode} ${styles.kickNode}`}>
        <PlatformIcon kind="kick" />
        <span><strong>Kick</strong><small>Live</small></span>
        <i />
      </div>

      <div className={styles.studioWindow}>
        <div className={styles.studioChrome}>
          <div className={styles.chromeBrand}>
            <Image src="/logo.png" width={20} height={20} alt="" />
            <span>ditch studio</span>
          </div>
          <div className={styles.liveBadge}><i /> LIVE</div>
        </div>

        <div className={styles.broadcastFrame}>
          <div className={styles.hostScene}>
            <div className={styles.sceneGlow} />
            <div className={styles.soundBars} aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    "--height": `${8 + index * 1.6}px`,
                    "--delay": `${index * -70}ms`,
                  } as CSSProperties}
                />
              ))}
            </div>
            <div className={styles.hostAvatar}>
              <span>JL</span>
            </div>
            <div className={styles.showTitle}>
              <small>NOW STREAMING</small>
              <strong>AFTER HOURS</strong>
            </div>
          </div>
          <div className={styles.guestScene}>
            <div className={styles.guestAvatar}>AM</div>
            <span>Audience guest</span>
          </div>
          <div className={styles.frameLowerThird}>
            <span>Jules + Amara</span>
            <small>LIVE ON DITCH</small>
          </div>
        </div>

        <div className={styles.studioFooter}>
          <span><MicIcon /> Mic</span>
          <span><CameraIcon /> Camera</span>
          <button type="button" tabIndex={-1}>End stream</button>
        </div>
      </div>

      <div className={styles.joinToast}>
        <div className={styles.joinAvatar}>KA</div>
        <span><strong>Kai wants to join</strong><small>From YouTube</small></span>
        <b>Review</b>
      </div>

      <div className={styles.chatToast}>
        <span className={styles.chatPlatform}>TW</span>
        <p><strong>mina_live</strong> bring Kai on!</p>
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
              <i className={styles[destination.tone]} />
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
