import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "./LandingPage";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/home");
  }

  return <LandingPage />;
}

const PLATFORMS = ["Twitch", "YouTube", "TikTok", "Kick"];

const FEATURES = [
  {
    label: "Simulcast",
    title: "One signal, every channel",
    body: "Go live once from your browser. DITCH carries the same broadcast to Twitch, YouTube, TikTok and Kick at the same time, so your audience sees you wherever they already are.",
    icon: FanoutIcon,
  },
  {
    label: "Studio floor",
    title: "Viewers step on stage",
    body: "Any viewer, from any platform, can ask to join. Cue them in and they appear on screen live, visible to your whole audience everywhere at once.",
    icon: StageIcon,
  },
  {
    label: "Signal loop",
    title: "The loop runs itself",
    body: "Someone finds you on one platform and joins your channel. Their followers see them on screen and come to watch. Your audience grows because people want to be part of the show.",
    icon: LoopIcon,
  },
];

const STEPS = [
  { step: "01", title: "Claim your channel", body: "Sign up and get your DITCH link. It takes about 30 seconds." },
  { step: "02", title: "Connect your platforms", body: "Link Twitch, YouTube, TikTok and Kick once. DITCH remembers them." },
  { step: "03", title: "Go live from your browser", body: "Camera, mic and screenshare run in the browser studio. Nothing to install." },
  { step: "04", title: "Cue viewers in", body: "Your audience asks to join. You cue them in. They go live on every platform at once." },
];

const FAQS = [
  {
    q: "Do I need to install anything?",
    a: "No. The whole studio runs in your browser. Camera, mic and screenshare work without any download.",
  },
  {
    q: "Does cross-streaming break platform rules?",
    a: "DITCH is the origin of your stream, not a third party relaying another platform's feed, so the usual cross-streaming restrictions do not apply.",
  },
  {
    q: "Can I still use OBS?",
    a: "Yes. Point OBS at your DITCH ingest and we fan it out to every destination for you.",
  },
  {
    q: "How much does it cost?",
    a: "DITCH is free during public beta.",
  },
];

function HomePageContent() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)] antialiased">
      <Header />

      <main>
        {/* hero */}
        <section className="relative overflow-hidden">
          {/* soft pink glow, the only ambient flourish */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[44rem] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
            style={{ background: "radial-gradient(circle, var(--accent-primary), transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-20 text-center sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-primary)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
              </span>
              Live, everywhere, at once
            </span>

            <h1 className="mx-auto mt-7 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--text-white)] sm:text-6xl">
              Go live once.
              <br />
              Stream <span className="text-[var(--accent-primary)]">everywhere.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              DITCH carries one signal to every platform and turns viewers from
              any of them into participants on your stream. One broadcast. One
              room. Every audience.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90 sm:w-auto"
              >
                Claim your channel
                <ArrowIcon />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-7 py-3.5 text-[15px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--text-muted)] sm:w-auto"
              >
                See how it works
              </Link>
            </div>

            {/* platform row */}
            <div className="mt-16">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Streams to
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {PLATFORMS.map((name) => (
                  <span key={name} className="text-lg font-semibold text-[var(--text-primary)]/70">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                What DITCH is
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-white)] sm:text-4xl">
                Not just a streaming tool.
              </h2>
              <p className="mt-4 text-[var(--text-muted)]">
                A live home base that follows you across every platform and
                brings the whole audience into one interactive room.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.label}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-7 transition hover:border-[var(--text-muted)]/40"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-mid)] text-[var(--accent-primary)]">
                      <Icon />
                    </div>
                    <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {feature.label}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--text-white)]">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
                      {feature.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how-it-works" className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-white)] sm:text-4xl">
                Set up once. Stream everywhere.
              </h2>
            </div>

            <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <div key={item.step}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-semibold text-[var(--accent-primary)]">
                      {item.step}
                    </span>
                    <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--text-white)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-14 text-[14px] text-[var(--text-muted)]">
              Prefer OBS? Point it at your DITCH ingest and we handle the rest.
            </p>
          </div>
        </section>

        {/* faq */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-3xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-white)] sm:text-4xl">
              Questions
            </h2>
            <div className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-[var(--text-white)]">
                    {item.q}
                    <span className="text-[var(--text-muted)] transition-transform group-open:rotate-45">
                      <PlusIcon />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* cta */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-base)] px-8 py-16 text-center sm:px-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full opacity-20 blur-[100px]"
                style={{ background: "radial-gradient(circle, var(--accent-primary), transparent 70%)" }}
              />
              <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text-white)] sm:text-4xl">
                Your audience is split across four platforms. Bring them together.
              </h2>
              <p className="relative mx-auto mt-5 max-w-xl text-[var(--text-muted)] sm:text-lg">
                Free during public beta. Nothing to install, and your first
                stream is minutes away.
              </p>
              <div className="relative mt-9">
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-8 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
                >
                  Claim your channel
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span className="text-[16px] font-semibold tracking-tight text-[var(--text-white)]">
            ditch
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/auth"
            className="rounded-lg px-3 py-2 text-[14px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={22} height={22} className="rounded" />
            <span className="text-[15px] font-semibold text-[var(--text-white)]">ditch</span>
          </span>
          <nav aria-label="footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/terms" className="text-[14px] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
              Terms
            </Link>
            <Link href="/privacy" className="text-[14px] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
              Privacy
            </Link>
            <a href="mailto:sendmailtodex@gmail.com" className="text-[14px] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
              Contact
            </a>
          </nav>
        </div>
        <div className="flex flex-col items-start justify-between gap-2 border-t border-[var(--border)] pt-6 text-[13px] text-[var(--text-muted)] sm:flex-row sm:items-center">
          <span>ditch, Rome</span>
          <span>© 2026 ditch. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

/* ── inline icons (stroke, currentColor) ─────────────────────────── */

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FanoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.4" />
      <circle cx="19" cy="5" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
      <circle cx="19" cy="19" r="2.2" />
      <path d="M7.3 11.2 16.8 5.6M7.4 12h9.4M7.3 12.8l9.5 5.6" />
    </svg>
  );
}

function StageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9a8 8 0 0 1 13.7-4.3L20 7" />
      <path d="M20 4v3h-3" />
      <path d="M20 15a8 8 0 0 1-13.7 4.3L4 17" />
      <path d="M4 20v-3h3" />
    </svg>
  );
}
