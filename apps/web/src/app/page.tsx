import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/home");
  }

  return <HomePageContent />;
}

function HomePageContent() {
  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-surface-border)] bg-[var(--color-surface)]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="DITCH" className="h-8 w-8 rounded-md" />
            <span className="text-xl font-bold tracking-tight text-[var(--color-brand)]">DITCH</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
            >
              Sign in
            </Link>
            <Link
              href="/auth"
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-light)]"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand)] opacity-10 blur-[120px]" />
            <div className="absolute left-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-[var(--color-brand)] opacity-5 blur-[100px]" />
            <div className="absolute right-1/4 bottom-1/3 h-[300px] w-[300px] rounded-full bg-blue-500 opacity-5 blur-[80px]" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Now in public beta
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              One stream.
              <br />
              <span className="text-[var(--color-brand)]">Every platform.</span>
              <br />
              Anyone can join.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-[var(--color-text-muted)] sm:text-xl">
              Go live from your browser and hit Twitch, YouTube, TikTok, and Kick at the same time. Viewers from any of them can step off the sidelines and appear on your stream — live, visible to everyone, everywhere.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[var(--color-brand-light)]"
              >
                Start Streaming Free
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] px-8 py-4 text-lg font-semibold transition hover:border-[var(--color-brand)]"
              >
                See How It Works
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-16 w-full max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-[var(--color-surface-border)] px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-[var(--color-text-muted)]">DITCH Control Room</span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-4">
                <div className="col-span-2 aspect-video rounded-lg bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--color-brand)]/5 p-4">
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand)]/20">
                        <svg className="h-8 w-8 text-[var(--color-brand)]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">Live Preview</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-video rounded-lg bg-[var(--color-surface)] p-2">
                      <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-[var(--color-surface-border)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--color-surface-border)] px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    LIVE
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">4 platforms connected</span>
                </div>
                <div className="flex gap-2">
                  {["Twitch", "YouTube", "TikTok", "Kick"].map((p) => (
                    <span key={p} className="rounded bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Not just a streaming tool.</h2>
              <p className="text-lg text-[var(--color-text-muted)]">Most tools push your video out. DITCH is where your audience becomes part of it.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <FeatureCard
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                title="Stream everywhere, at once"
                description="Point your broadcasting software at DITCH. We push it to Twitch, YouTube, TikTok, and Kick simultaneously. You run one stream. Your audience is on every platform."
              />
              <FeatureCard
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                title="Viewers don't just watch"
                description="Any viewer — on Twitch, on YouTube, wherever — can request to join your stream. Accept them and they're on screen, live, visible to your whole audience across every platform at once."
              />
              <FeatureCard
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                }
                title="The loop runs itself"
                description="Someone finds you on Twitch. They join your stream on DITCH. Their followers see them on screen. Those followers come to watch. Your audience grows because people want to be part of it — not because you ran an ad."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-[var(--color-surface-border)] py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How it works</h2>
              <p className="text-lg text-[var(--color-text-muted)]">Set up once. Stream everywhere, forever.</p>
            </div>

            <div className="grid gap-12 md:grid-cols-4">
              {[
                { step: "01", title: "Claim your channel", desc: "Sign up and get your DITCH link. Takes 30 seconds." },
                { step: "02", title: "Connect your platforms", desc: "Link Twitch, YouTube, TikTok, Kick — whichever you use. Done once, remembered forever." },
                { step: "03", title: "Go live", desc: "Stream from your browser. No software to install. DITCH pushes it everywhere." },
                { step: "04", title: "Let viewers in", desc: "Your audience requests to join. You approve. They're on screen — live, across every platform." },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-2xl font-bold text-[var(--color-brand)]">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-surface-border)] py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Your audience is split across four platforms. Bring them together.</h2>
            <p className="mb-10 text-lg text-[var(--color-text-muted)]">
              Free to start. No software to download. Just your stream, on every platform at once.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[var(--color-brand-light)]"
            >
              Start for Free
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-surface-border)] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="DITCH" className="h-8 w-8 rounded-md" />
              <span className="text-xl font-bold tracking-tight text-[var(--color-brand)]">DITCH</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              © 2026 DITCH. One stream. Every platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] p-8 transition hover:border-[var(--color-brand)]/50">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-semibold">{title}</h3>
      <p className="text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}