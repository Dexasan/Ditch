// Answers stay deliberately careful where they depend on platform policy.
// TODO(founder): review every answer below before launch, especially the
// Twitch simulcasting and TikTok LIVE access items. Platform policies move;
// verify against the current published terms rather than this copy.
import Reveal from "./Reveal";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "is multistreaming allowed by the platforms?",
    a: "Generally yes. Twitch, YouTube, TikTok and Kick all permit simulcasting under their standard terms. A specific contract you have signed with a platform can override that, so check your agreements before going live everywhere.",
  },
  {
    q: "what about twitch exclusivity rules for partners?",
    a: "Twitch allows simulcasting for most creators under its simulcasting guidelines. Some Partner contracts include exclusivity terms that take priority over the general rules. If you are a Partner, read your agreement or ask your Twitch contact first.",
  },
  {
    q: "do i need tiktok live access?",
    a: "Yes. TikTok only provides a stream key to accounts with LIVE access, which TikTok grants based on its own criteria such as follower count and region. Once your account has it, DITCH broadcasts there like any other channel.",
  },
  {
    q: "is there extra latency?",
    a: "A little. DITCH relays your stream to each platform, which adds a small delay on top of the delay every platform already has. Interaction happens on your DITCH channel in real time, so chat and cue-ins do not wait on platform delay.",
  },
  {
    // TODO(founder): confirm which platform chats are ingested in the
    // current build and adjust this answer before launch.
    q: "is chat unified?",
    a: "Messages from your DITCH channel and connected platforms come into one combined view in the studio, with each message labeled by its source platform.",
  },
  {
    q: "what does it cost?",
    a: "DITCH is free during public beta. Paid plans will come later, and beta creators will hear about pricing well before anything changes.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="mc-mono mb-3 text-[12px] text-label">faq</p>
      <h2 className="mb-10 text-2xl font-medium text-ink sm:text-3xl">
        Straight answers.
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {FAQ_ITEMS.map((item, index) => (
          <Reveal key={item.q} delay={(index % 2) * 90}>
            <div className="h-full rounded-xl border border-line bg-panel p-5 sm:p-6">
              <h3 className="mc-mono mb-3 text-[12px] text-label">{item.q}</h3>
              <p className="text-[15px] leading-relaxed text-label">
                {item.a}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
