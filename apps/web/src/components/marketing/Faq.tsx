"use client";

// Accordion FAQ. Each row is a channel that "powers on" when opened: its
// tally lights pink and a quick scanline sweeps the answer. Built on real
// buttons so it is keyboard accessible; the JSON-LD still ships every
// answer for search engines regardless of open state.
// Answers stay deliberately careful where they depend on platform policy.
// TODO(founder): review every answer below before launch, especially the
// Twitch simulcasting and TikTok LIVE access items. Platform policies move;
// verify against the current published terms rather than this copy.
import { useState } from "react";

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
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="mc-mono mb-3 text-[12px] text-label">faq</p>
      <h2 className="mb-10 text-2xl font-medium text-ink sm:text-3xl">
        Straight answers.
      </h2>
      <div className="flex flex-col">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q} className="border-t border-line last:border-b">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 py-5 text-left"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full transition-colors ${isOpen ? "bg-tally" : "bg-line"}`}
                />
                <span className="mc-mono flex-1 text-[12px] text-ink">{item.q}</span>
                <span
                  aria-hidden="true"
                  className={`text-label transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <p className="pb-5 pl-5 pr-6 text-[15px] leading-relaxed text-label">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
