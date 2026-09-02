import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import sections from "./landing-sections.module.css";
import TransmissionField from "./TransmissionField";

const DESTINATIONS = [
  { name: "Twitch", logo: "/platforms/twitch.png", tone: "purple" },
  { name: "YouTube", logo: "/platforms/youtube.png", tone: "red" },
  { name: "TikTok", logo: "/platforms/tiktok.png", tone: "cyan" },
  { name: "Kick", logo: "/platforms/kick.svg", tone: "green" },
] as const;

/* The audience reacts to the dogs-versus-cats screen share. */
const CHAT_MESSAGES = [
  { id: "m1", user: "rex_thegoodboy", platform: "twitch", body: "scavenging? I prefer snack researcher." },
  { id: "m2", user: "mittens", platform: "ditch", body: "obligate carnivore. finally, my job title." },
  { id: "m3", user: "borkfast_club", platform: "youtube", body: "pack animals = we have a group chat." },
  { id: "m4", user: "pug_life", platform: "tiktok", body: "running long distances? wrong dog." },
  { id: "m5", user: "whiskers_ceo", platform: "ditch", body: "independent, but the bowl is empty. explain." },
  { id: "m6", user: "sir_barksalot", platform: "kick", body: "command, perform trick, receive reward. fair contract." },
  { id: "m7", user: "beagle_bites", platform: "twitch", body: "cue me in. I have notes on the snack section." },
] as const;

const FEATURES = [
  { title: "Produce", body: "Run camera, mic, screens and scenes in your browser, or bring OBS." },
  { title: "Distribute", body: "Connect Twitch, YouTube, TikTok and Kick once for every show." },
  { title: "Participate", body: "Turn your Ditch channel into a room where viewers become guests." },
] as const;

const COMPARISON_ROWS = [
  { need: "Setup", oldWay: "Apps, plugins, relays", ditchWay: "Browser or OBS" },
  { need: "Destinations", oldWay: "Separate dashboards", ditchWay: "One saved setup" },
  { need: "Guests", oldWay: "Call links and scene edits", ditchWay: "A queue inside the show" },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <TransmissionField />
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <Header />

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroMain}>
            <p className={styles.eyebrow}>
              <span className={styles.liveDot} aria-hidden="true" />
              The live participation network
            </p>

            <h1 id="hero-title" className={styles.heroTitle}>
              <span>Stream everywhere.</span>
              <strong>Bring your audience</strong>
              <em>onstage.</em>
            </h1>
          </div>

          <div className={styles.heroAside}>
            <p className={styles.heroLead}>
              Run your show in the browser, send it to Twitch, YouTube, TikTok
              and Kick, and let viewers request a spot and join live - no
              download or account.
            </p>

            <div className={styles.heroActions}>
              <Link href="/auth?mode=signup" className={styles.primaryButton}>
                Create your free channel
                <span aria-hidden="true">-&gt;</span>
              </Link>
              <a href="#product" className={styles.textButton}>
                Watch a viewer join
              </a>
            </div>
            <p className={styles.trustStrip}>
              Free during public beta · No card required · No download · OBS supported
            </p>
          </div>

          <div className={styles.platformLine}>
            <span>One broadcast</span>
            <ul aria-label="Supported streaming destinations">
              {DESTINATIONS.map((destination) => (
                <li key={destination.name}>
                  <PlatformMark
                    logo={destination.logo}
                    tone={destination.tone}
                  />
                  {destination.name}
                </li>
              ))}
            </ul>
            <span>Your Ditch channel</span>
          </div>
        </section>

        <section className={sections.studio} id="studio" aria-labelledby="studio-title">
          <div className={sections.compactHeading}>
            <span className={sections.index}>01 / THE STUDIO</span>
            <h2 id="studio-title">Your show, in one room.</h2>
          </div>
          <BroadcastBoard />
        </section>

        <WalkOn />

        <section className={sections.features} id="features" aria-label="Produce, distribute, participate">
          {FEATURES.map((feature) => (
            <article key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className={sections.comparison} id="why-ditch" aria-labelledby="comparison-title">
          <div className={sections.compactHeading}>
            <span className={sections.index}>03 / WHY DITCH</span>
            <h2 id="comparison-title">Less setup. More show.</h2>
          </div>
          <table>
            <caption className={styles.srOnly}>Traditional streaming setup compared with Ditch</caption>
            <thead>
              <tr><th scope="col">The work</th><th scope="col">Traditional setup</th><th scope="col">With Ditch</th></tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.need}>
                  <th scope="row">{row.need}</th>
                  <td data-label="Traditional setup">{row.oldWay}</td>
                  <td data-label="With Ditch">{row.ditchWay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={sections.earnings} aria-labelledby="earnings-title">
          <div>
            <p className={sections.index}>Coming next</p>
            <h2 id="earnings-title">Your audience pays you back.</h2>
          </div>
          <p>
            Sponsored seats are coming. Brands pay to put a real person inside
            your live show, across every destination you stream to. <strong>60%
            of that revenue goes to you.</strong>
          </p>
        </section>

        <section className={sections.finalCta} id="start" aria-labelledby="cta-title">
          <span className={sections.index}>04 / OPEN THE ROOM</span>
          <h2 id="cta-title">Give them somewhere to enter.</h2>
          <div className={styles.ctaActions}>
            <Link href="/auth?mode=signup" className={styles.primaryButton}>
              Claim your channel
              <span aria-hidden="true">-&gt;</span>
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
        <Link href="/" className={styles.wordmark} aria-label="Ditch home">
          <Image src="/logo.png" width={34} height={34} alt="" priority />
          <span>
            <strong>DITCH</strong>
            <small>Live broadcast network</small>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <a href="#features">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#why-ditch">Why Ditch</a>
        </div>

        <div className={styles.navActions}>
          <Link href="/auth?mode=signin" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/auth?mode=signup" className={styles.navCta}>
            Start free
            <span aria-hidden="true">-&gt;</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}

function WalkOn() {
  return (
    <section className={sections.walkOn} id="product" aria-labelledby="walk-on-title">
      <div className={sections.walkOnInner} id="how-it-works">
        <p className={sections.index}>02 / THE WALK-ON</p>
        <div className={sections.walkOnHeading}>
          <h2 id="walk-on-title">From chat to <span>onstage.</span></h2>
          <p>No account. No download. Any viewer, on screen, everywhere you stream.</p>
        </div>

        <ol className={sections.walkOnSteps} aria-label="How a viewer joins your show">
          <li>
            <div className={sections.stepLabel}><span>01</span><h3>Request a spot.</h3></div>
            <div className={sections.watchPreview} aria-hidden="true">
              <Image src="/studio-host.webp" alt="" fill sizes="(max-width: 680px) 354px, 300px" />
              <span className={sections.previewLabel}>Watching your Ditch channel</span>
              <span className={sections.previewAction}>Request a spot <b>-&gt;</b></span>
            </div>
            <p>A viewer watching your channel asks to join.</p>
          </li>
          <li>
            <div className={sections.stepLabel}><span>02</span><h3>Join the queue.</h3></div>
            <div className={sections.queuePreview} aria-hidden="true">
              <span className={sections.previewLabel}>Participant queue / 01</span>
              <div className={sections.queueGuest}>
                <Image src="/studio-guest.webp" alt="" width={56} height={56} />
                <span>Guest 01<small>Waiting</small></span>
                <i />
              </div>
              <span className={sections.queueNote}>Request received</span>
            </div>
            <p>Their request appears in your participant queue.</p>
          </li>
          <li>
            <div className={sections.stepLabel}><span>03</span><h3>You cue them.</h3></div>
            <div className={sections.cuePreview} aria-hidden="true">
              <span className={sections.previewLabel}>Host control</span>
              <div className={sections.queueGuest}>
                <Image src="/studio-guest.webp" alt="" width={56} height={56} />
                <span>Guest 01<small>Ready for your cue</small></span>
              </div>
              <span className={sections.previewAction}>Cue onstage <b>-&gt;</b></span>
            </div>
            <p>You choose who joins and when they go on screen.</p>
          </li>
          <li>
            <div className={sections.stepLabel}><span>04</span><h3>Live, together.</h3></div>
            <div className={sections.onstagePreview} aria-hidden="true">
              <span className={sections.previewLabel}><i /> On air / Host + guest</span>
              <div className={sections.livePair}>
                <Image src="/studio-host.webp" alt="" width={150} height={150} />
                <Image src="/studio-guest.webp" alt="" width={150} height={150} />
              </div>
              <span className={sections.liveDestinations}>Twitch · YouTube · TikTok · Kick</span>
            </div>
            <p>They are live beside you, across every connected destination.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function BroadcastBoard() {
  return (
    <div className={styles.studioPreview}>
      <div className={styles.spTopBar}>
        <span className={styles.spBrand}>
          <Image src="/logo.png" width={22} height={22} alt="" />
          <b>
            DITCH
            <small>Transmission control</small>
          </b>
        </span>

        <span className={styles.spChannel}>
          <small>Channel</small>
          <b>your-channel</b>
        </span>

        <span className={styles.spState}>
          <i aria-hidden="true" />
          On air
        </span>

        <span className={styles.spMeta}>
          <small>TC</small>
          <b>00:14:26:11</b>
        </span>

        <span className={styles.spMeta} data-hide-narrow="true">
          <small>Frame rate</small>
          <b>60 FPS</b>
        </span>

        <span className={styles.spGoLive}>End stream</span>
      </div>

      <div className={styles.spBody}>
        <aside className={styles.spRail}>
          <div className={styles.spRailGroup}>
            <p>
              Scenes<span>01</span>
            </p>
            <ul>
              <li data-active="true">Scene 1</li>
            </ul>
          </div>

          <div className={styles.spRailGroup}>
            <p>
              Layers<span>03</span>
            </p>
            <ul>
              <li data-active="true">Screen share</li>
              <li>Cam 01</li>
              <li>Guest 01</li>
            </ul>
          </div>
        </aside>

        <div className={styles.spDeck}>
          <div className={styles.spDeckHead}>
            <span className={styles.spBus}>
              <i aria-hidden="true" />
              Program output
            </span>
            <strong>Scene 1</strong>
            <div className={styles.spTelemetry}>
              <span>
                Canvas <b>1280 X 720</b>
              </span>
              <span>
                Frame <b>60 FPS</b>
              </span>
              <span>
                Stage <b>2/4</b>
              </span>
            </div>
          </div>

          <div className={styles.spCanvas}>
            <SharedSlide />

            <div className={styles.spCams}>
              <figure className={styles.spCam}>
                <Image
                  src="/studio-host.webp"
                  alt="Host camera: a cat in a streaming studio"
                  fill
                  sizes="(max-width: 900px) 50vw, 300px"
                  className={styles.spCamImage}
                  priority
                />
                <figcaption>
                  <b>You</b>
                  <span>Cam 01</span>
                </figcaption>
              </figure>

              <figure className={styles.spCam}>
                <Image
                  src="/studio-guest.webp"
                  alt="Guest camera: a viewer who joined the broadcast"
                  fill
                  sizes="(max-width: 900px) 50vw, 300px"
                  className={styles.spCamImage}
                />
                <figcaption>
                  <b>Audience</b>
                  <span>Joined from your Ditch channel</span>
                </figcaption>
              </figure>
            </div>
          </div>

          <div className={styles.spSignalRail}>
            {[
              "Input 01 / Screen share",
              "Compositor / 03 sources",
              "Uplink / Transmitting",
              "Room / 02 on stage",
            ].map((message) => (
              <span key={message}>
                <i aria-hidden="true" />
                {message}
              </span>
            ))}
          </div>
        </div>

        <aside className={styles.spInspector}>
          <div className={styles.spTabs}>
            <span>Properties</span>
            <span data-active="true">Chat</span>
            <span>
              Queue<b>3</b>
            </span>
          </div>

          <ul className={styles.spChat}>
            {CHAT_MESSAGES.map((message) => (
              <li key={message.id} data-platform={message.platform}>
                <span className={styles.spChatUser}>
                  <i aria-hidden="true" data-platform={message.platform} />
                  {message.user}
                </span>
                <p>{message.body}</p>
              </li>
            ))}
          </ul>

          <div className={styles.spChatBar}>
            <span>Say something</span>
            <b>Send</b>
          </div>
        </aside>
      </div>

      <div className={styles.spUplink}>
        <span className={styles.spUplinkLabel}>Uplink</span>
        <ul>
          {DESTINATIONS.map((destination) => (
            <li key={destination.name}>
              <PlatformMark logo={destination.logo} tone={destination.tone} />
              <b>{destination.name}</b>
              <i aria-hidden="true" />
            </li>
          ))}
        </ul>
        <span className={styles.spUplinkRate}>7 800 kbps</span>
      </div>
    </div>
  );
}

/* The supplied image is shared intact inside the program canvas. */
function SharedSlide() {
  return (
    <figure className={styles.spSlide}>
      <figcaption>Screen share</figcaption>
      <Image
        src="/studio-dogs-vs-cats.jpg"
        alt="Dogs versus cats: differences in diet, temperament and behavior, shown on the host's shared screen."
        width={720}
        height={720}
        sizes="(max-width: 900px) 90vw, 600px"
        className={styles.spSharedImage}
        unoptimized
      />
    </figure>
  );
}

function PlatformMark({
  logo,
  tone,
}: {
  logo: string;
  tone: string;
}) {
  return (
    <span className={styles.platformMark} data-tone={tone} aria-hidden="true">
      <Image src={logo} alt="" width={24} height={24} />
    </span>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <Link href="/" className={styles.wordmark} aria-label="Ditch home">
          <Image src="/logo.png" width={34} height={34} alt="" />
          <span>
            <strong>DITCH</strong>
            <small>One room. Every audience.</small>
          </span>
        </Link>
        <nav aria-label="Footer navigation">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@ditchlive.app">Contact</a>
        </nav>
      </div>
      <div className={styles.footerMeta}>
        <span>Ditch, Rome</span>
        <span>&copy; 2026 Ditch. All rights reserved.</span>
      </div>
    </footer>
  );
}
