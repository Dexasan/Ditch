import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import TransmissionField from "./TransmissionField";

const DESTINATIONS = [
  { name: "Twitch", code: "TW", tone: "purple" },
  { name: "YouTube", code: "YT", tone: "red" },
  { name: "TikTok", code: "TK", tone: "cyan" },
  { name: "Kick", code: "KI", tone: "green" },
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

            <p className={styles.heroNote}>
              No download. No pile of plugins. OBS is welcome if you want it.
            </p>
          </div>

          <div className={styles.platformLine}>
            <span>One broadcast</span>
            <ul aria-label="Supported streaming destinations">
              {DESTINATIONS.map((destination) => (
                <li key={destination.name}>
                  <PlatformMark
                    code={destination.code}
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
    <div className={styles.broadcastBoard}>
      <div className={styles.boardChrome}>
        <span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </span>
        <b>ditch.live/c/your-channel</b>
        <em>
          <i aria-hidden="true" />
          Live / 00:14:26
        </em>
      </div>

      <div className={styles.boardBody}>
        <div className={styles.liveRoom}>
          <div className={styles.roomLabel}>
            <span>Program preview</span>
            <b>Audience on screen</b>
          </div>

          <div className={styles.stage}>
            <article className={styles.hostFeed}>
              <span className={styles.feedCode}>HOST / CAM 01</span>
              <div className={styles.hostPortrait} aria-hidden="true">
                YOU
              </div>
              <footer>
                <strong>Your show</strong>
                <span>Mic on</span>
              </footer>
            </article>

            <article className={styles.guestFeed}>
              <span className={styles.feedCode}>GUEST / DITCH</span>
              <div className={styles.guestPortrait} aria-hidden="true">
                G
              </div>
              <footer>
                <strong>Guest slot</strong>
                <span>On stage</span>
              </footer>
            </article>

            <div className={styles.joinRequest}>
              <span>Twitch viewer</span>
              <p>Requesting the open guest slot</p>
              <b>Cued in</b>
            </div>
          </div>
        </div>

        <div className={styles.signalRoute} aria-hidden="true">
          <span className={styles.routeLine} />
          <span className={styles.routePulse} />
          <div>
            <Image src="/logo.png" width={44} height={44} alt="" />
            <b>DITCH</b>
            <small>Origin</small>
          </div>
        </div>

        <div className={styles.outputs}>
          <div className={styles.outputHeading}>
            <span>Destinations</span>
            <b>04 / 04 live</b>
          </div>
          <ul>
            {DESTINATIONS.map((destination) => (
              <li key={destination.name}>
                <PlatformMark
                  code={destination.code}
                  tone={destination.tone}
                />
                <span>
                  <strong>{destination.name}</strong>
                  <small>1080P / 30 FPS</small>
                </span>
                <b>
                  <i aria-hidden="true" />
                  Live
                </b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.returnPath}>
        <span>Audience return</span>
        <p>
          Watch anywhere
          <i aria-hidden="true">-&gt;</i>
          enter the Ditch room
          <i aria-hidden="true">-&gt;</i>
          request to join
          <i aria-hidden="true">-&gt;</i>
          appear on screen
        </p>
        <span className={styles.returnPulse} aria-hidden="true" />
      </div>
    </div>
  );
}

function PlatformMark({
  code,
  tone,
}: {
  code: string;
  tone: string;
}) {
  return (
    <span className={styles.platformMark} data-tone={tone} aria-hidden="true">
      {code}
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