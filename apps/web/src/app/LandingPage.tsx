import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import TransmissionField from "./TransmissionField";

const DESTINATIONS = [
  { name: "Twitch", logo: "/platforms/twitch.png", tone: "purple" },
  { name: "YouTube", logo: "/platforms/youtube.png", tone: "red" },
  { name: "TikTok", logo: "/platforms/tiktok.png", tone: "cyan" },
  { name: "Kick", logo: "/platforms/kick.svg", tone: "green" },
] as const;

/* The slide being screen-shared inside the studio preview. */
const SLIDE_BRANCHES = [
  {
    claim: "Cats cost less to keep than dogs.",
    support: ["Cats eat less than dogs.", "Their gear is smaller and cheaper."],
  },
  {
    claim: "Cats need less time than dogs.",
    support: ["No walks, ever.", "They wash themselves."],
  },
] as const;

/* Unified chat: the dogs in the audience are not taking it well. */
const CHAT_MESSAGES = [
  {
    user: "rex_thegoodboy",
    platform: "twitch",
    body: "this is slander and i will not stand for it",
  },
  {
    user: "borkfast_club",
    platform: "youtube",
    body: "\"they wash themselves\" ok and? we ROLL in things. character.",
  },
  {
    user: "pug_life",
    platform: "tiktok",
    body: "no walks is a CON. respectfully.",
  },
  {
    user: "sir_barksalot",
    platform: "kick",
    body: "mods. MODS.",
  },
  {
    user: "mittens",
    platform: "ditch",
    body: "let him cook",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Claim your channel",
    body: "Choose your Ditch address. It becomes the permanent home for every live session.",
  },
  {
    number: "02",
    title: "Save your destinations",
    body: "Connect Twitch, YouTube, TikTok, and Kick once. Turn any destination on or off for each show.",
  },
  {
    number: "03",
    title: "Open the studio and go live",
    body: "Use your camera, mic, and screen in the browser, or bring OBS. One launch sends the show everywhere.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    need: "Start",
    oldWay: "Install studio software, add plugins, and wire a relay.",
    ditchWay: "Open one browser tab, or bring the OBS setup you already know.",
  },
  {
    need: "Reach",
    oldWay: "Broadcast to one platform or add another service to the stack.",
    ditchWay: "Send one show to every destination you have saved.",
  },
  {
    need: "Audience",
    oldWay: "Leave viewers split between separate platforms and chats.",
    ditchWay: "Give the show one Ditch channel alongside every platform output.",
  },
  {
    need: "Guests",
    oldWay: "Share separate call links, then rebuild the scene around them.",
    ditchWay: "Let viewers request a spot and cue them directly onto the broadcast.",
  },
] as const;

const USE_CASES = [
  "Live podcasts",
  "Interviews",
  "Call-in shows",
  "Co-streams",
  "Q and As",
  "Community nights",
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
              Browser studio + live channel
            </p>

            <h1 id="hero-title" className={styles.heroTitle}>
              <span>Go live.</span>
              <strong>Everywhere.</strong>
              <em>Let people in.</em>
            </h1>
          </div>

          <div className={styles.heroAside}>
            <p className={styles.heroLead}>
              Ditch is a <strong>browser-based livestream studio</strong> and a{" "}
              <strong>streaming platform</strong> in one. Produce your show,
              send it to every major platform, then bring viewers onto the
              broadcast.
            </p>

            <div className={styles.heroActions}>
              <Link href="/auth" className={styles.primaryButton}>
                Start streaming free
                <span aria-hidden="true">-&gt;</span>
              </Link>
              <a href="#how-it-works" className={styles.textButton}>
                See how it works
              </a>
            </div>
          </div>

          <p className={styles.heroNote}>
            <span className={styles.heroNoteBadge}>No setup</span>
            <span className={styles.heroNoteText}>
              No download. No pile of plugins. OBS is welcome if you want it.
            </span>
          </p>

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

        <section className={styles.signalSection} id="product">
          <SectionHeading
            number="01"
            label="The signal"
            title="One room runs the whole live."
            body="Ditch sits at the center. Your show goes out to every platform, while the audience has one place to watch, chat, and step on screen."
          />
          <BroadcastBoard />
        </section>

        <section className={styles.definitionSection}>
          <div className={styles.sectionIndex}>
            <span>02</span>
            <span>What Ditch is</span>
          </div>

          <div className={styles.definitionIntro}>
            <p>Two sides of the same live session.</p>
            <h2>
              A streaming tool when you need reach.
              <span>A streaming platform when you need a room.</span>
            </h2>
          </div>

          <div className={styles.definitionPair}>
            <article>
              <span className={styles.definitionCode}>A / THE TOOL</span>
              <h3>Open a tab. Run the show.</h3>
              <p>
                Camera, mic, screen share, scenes, guests, and every output live
                in the browser. If OBS is already part of your workflow, send
                that signal into Ditch instead.
              </p>
            </article>
            <article>
              <span className={styles.definitionCode}>B / THE PLATFORM</span>
              <h3>Give the show one address.</h3>
              <p>
                Your Ditch channel is a place to watch, chat, and request to
                join. It stays open while the same show reaches viewers on
                Twitch, YouTube, TikTok, and Kick.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.stepsSection} id="how-it-works">
          <SectionHeading
            number="03"
            label="From zero to live"
            title="Set up once. Start in minutes."
            body="The technical parts stay out of the way, so you can spend your energy on the format, the guests, and the people watching."
          />

          <ol className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.setupFacts} aria-label="Setup facts">
            <span>Nothing to install</span>
            <span>Destinations remembered</span>
            <span>Free during public beta</span>
          </div>
        </section>

        <section className={styles.comparisonSection} id="why-ditch">
          <SectionHeading
            number="04"
            label="Why Ditch"
            title="Run a show, not a streaming stack."
            body="Traditional setups make creators operate a collection of tools. Ditch turns the same work into one clear flow."
            inverted
          />

          <div className={styles.comparisonWrap}>
            <table className={styles.comparisonTable}>
              <caption className={styles.srOnly}>
                Traditional streaming setup compared with Ditch
              </caption>
              <thead>
                <tr>
                  <th scope="col">Need</th>
                  <th scope="col">Traditional setup</th>
                  <th scope="col">With Ditch</th>
                </tr>
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
          </div>
        </section>

        <section className={styles.useCases}>
          <p>Made for shows that get better when people join.</p>
          <ul>
            {USE_CASES.map((useCase) => (
              <li key={useCase}>{useCase}</li>
            ))}
          </ul>
        </section>

        <section className={styles.finalCta} id="start">
          <span className={styles.ctaIndex}>05 / OPEN THE ROOM</span>
          <p>Your next great guest is already watching.</p>
          <h2>Give them somewhere to enter.</h2>
          <div className={styles.ctaActions}>
            <Link href="/auth" className={styles.darkButton}>
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
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#why-ditch">Why Ditch</a>
        </div>

        <div className={styles.navActions}>
          <Link href="/auth" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/auth" className={styles.navCta}>
            Start free
            <span aria-hidden="true">-&gt;</span>
          </Link>
        </div>
      </nav>
    </header>
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
                  <span>Joined from Twitch</span>
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
              <li key={message.user} data-platform={message.platform}>
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

/* The creator's screen share: a slide the cats are arguing over. */
function SharedSlide() {
  return (
    <div className={styles.spSlide} aria-label="Shared screen: why cats beat dogs">
      <span className={styles.spSlideTag}>Screen share</span>

      <div className={styles.spSlideRoot}>Cats are better pets than dogs.</div>

      <div className={styles.spSlideBranches}>
        {SLIDE_BRANCHES.map((branch) => (
          <div key={branch.claim} className={styles.spSlideBranch}>
            <span className={styles.spSlideWhy}>because</span>
            <div className={styles.spSlideNode}>{branch.claim}</div>
            <div className={styles.spSlideLeaves}>
              {branch.support.map((leaf) => (
                <span key={leaf}>{leaf}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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

function SectionHeading({
  number,
  label,
  title,
  body,
  inverted = false,
}: {
  number: string;
  label: string;
  title: string;
  body: string;
  inverted?: boolean;
}) {
  return (
    <div className={styles.sectionHeading} data-inverted={inverted}>
      <div className={styles.sectionIndex}>
        <span>{number}</span>
        <span>{label}</span>
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
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
          <a href="mailto:sendmailtodex@gmail.com">Contact</a>
        </nav>
      </div>
      <div className={styles.footerMeta}>
        <span>Ditch, Rome</span>
        <span>&copy; 2026 Ditch. All rights reserved.</span>
      </div>
    </footer>
  );
}