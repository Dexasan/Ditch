import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonitorWall from "@/components/marketing/MonitorWall";
import Faq from "@/components/marketing/Faq";
import FeatureDiagram, { type DiagramKind } from "@/components/marketing/FeatureDiagram";
import NewsTicker from "@/components/marketing/NewsTicker";
import Reveal from "@/components/marketing/Reveal";
import LiveBackground from "@/components/marketing/LiveBackground";
import RoamingCreatures from "@/components/marketing/RoamingCreatures";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/home");
  }

  return <HomePageContent />;
}

const FEATURES: { label: string; title: string; body: string; kind: DiagramKind }[] = [
  {
    label: "simulcast",
    kind: "fanout",
    title: "One signal, every channel",
    body: "Go live once from your browser. DITCH pushes the same broadcast to Twitch, YouTube, TikTok and Kick at the same time, so your audience sees you wherever they already are.",
  },
  {
    label: "studio floor",
    kind: "cuein",
    title: "Viewers step on stage",
    body: "Any viewer, from any platform, can ask to join your stream. Cue them in and they appear on screen live, visible to your whole audience everywhere at once.",
  },
  {
    label: "signal loop",
    kind: "loop",
    title: "The loop runs itself",
    body: "Someone finds you on Twitch and joins your channel on DITCH. Their followers see them on screen and come to watch. Your audience grows because people want to be part of the show, not because you ran an ad.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "claim your channel",
    body: "Sign up and get your DITCH link. It takes about 30 seconds.",
  },
  {
    step: "02",
    title: "connect your platforms",
    body: "Link Twitch, YouTube, TikTok and Kick once. DITCH remembers them.",
  },
  {
    step: "03",
    title: "go live from your browser",
    body: "Camera, mic and screenshare run in the browser studio. Nothing to install.",
  },
  {
    step: "04",
    title: "cue viewers in",
    body: "Your audience asks to join. You cue them in. They are live on every platform at once.",
  },
];

function HomePageContent() {
  return (
    <div className="marketing relative min-h-screen">
      <LiveBackground />
      <RoamingCreatures />
      <SiteHeader />

      <main className="relative z-10">
        {/* hero: the monitor wall */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
          <MonitorWall />
          <p className="mx-auto mt-10 max-w-2xl text-center text-base leading-relaxed text-label sm:text-lg">
            Go live from your browser. DITCH carries one signal to every
            platform and lets viewers from any of them step onto your stream.
          </p>
        </section>

        {/* features */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <p className="mc-mono mb-3 text-[12px] text-label">what ditch is</p>
            <h2 className="mb-10 max-w-xl text-2xl font-medium text-ink sm:text-3xl">
              Not just a streaming tool.
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <Reveal key={feature.label} delay={index * 90}>
                  <div className="h-full rounded-xl border border-line bg-panel p-6 sm:p-7">
                    <div className="mb-5">
                      <FeatureDiagram kind={feature.kind} />
                    </div>
                    <p className="mc-mono mb-4 text-[11px] text-faint">
                      {feature.label}
                    </p>
                    <h3 className="mb-3 text-lg font-medium text-ink">
                      {feature.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-label">
                      {feature.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how-it-works" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <p className="mc-mono mb-3 text-[12px] text-label">how it works</p>
            <h2 className="mb-8 max-w-xl text-2xl font-medium text-ink sm:text-3xl">
              Set up once. Stream everywhere.
            </h2>
            {/* the signal bus running through the process */}
            <div className="mc-bus mb-10 w-full" aria-hidden="true" />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item, index) => (
                <Reveal key={item.step} delay={index * 90}>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="mc-led relative inline-block h-2 w-2 rounded-full bg-tally"
                      style={{ "--mc-delay": "0s", "--mc-seq": `${index * 0.6}s` } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <span className="mc-mono text-[12px] text-faint">{item.step}</span>
                  </div>
                  <h3 className="mc-mono mb-2 text-[13px] text-ink">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-label">
                    {item.body}
                  </p>
                </Reveal>
              ))}
            </div>
            <p className="mc-mono mt-12 text-[12px] text-label">
              prefer obs? point it at your ditch ingest and we handle the rest.
            </p>
          </div>
        </section>

        {/* social proof: keep it honest. No invented stats or testimonials.
            TODO(founder): when real beta numbers exist (creators live,
            hours streamed), add one quiet line here. */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <NewsTicker />
          </div>
        </section>

        {/* cta band */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
            <Reveal>
              <h2 className="mb-4 text-2xl font-medium text-ink sm:text-3xl">
                Your audience is split across four platforms. Bring them
                together.
              </h2>
              <p className="mb-10 text-base leading-relaxed text-label sm:text-lg">
                DITCH is free during public beta. Nothing to install, and your
                first stream is minutes away.
              </p>
              <div className="relative inline-flex">
                <span
                  className="mc-ring pointer-events-none absolute inset-0 rounded-lg border border-tally opacity-0"
                  aria-hidden="true"
                />
                <Link
                  href="/auth"
                  className="mc-mono relative inline-flex items-center justify-center gap-2 rounded-lg bg-tally px-8 py-3.5 text-[13px] text-paper transition hover:opacity-90"
                >
                  <span
                    className="mc-breathe-dot h-2 w-2 rounded-full bg-paper"
                    aria-hidden="true"
                  />
                  claim your channel
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="border-t border-line">
          <Faq />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
