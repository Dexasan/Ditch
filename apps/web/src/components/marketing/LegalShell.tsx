import LiveBackground from "./LiveBackground";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

// Shared frame for /terms and /privacy. Both documents ship with a visible
// draft notice until the founder signs off on the content.
// TODO(founder): review both documents, then remove the notice here.
const SHOW_DRAFT_NOTICE = true;

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="marketing relative min-h-screen">
      <LiveBackground />
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
        {SHOW_DRAFT_NOTICE && (
          <p className="mc-mono mb-8 rounded-lg border border-line bg-panel p-4 text-[12px] leading-relaxed text-label">
            draft for founder review. this document is a sensible starting
            point and has not yet been reviewed by counsel.
          </p>
        )}
        <p className="mc-mono mb-3 text-[12px] text-label">legal</p>
        <h1 className="mb-2 text-3xl font-medium text-ink">{title}</h1>
        <p className="mc-mono mb-12 text-[12px] text-faint">
          last updated: {updated}
        </p>
        <div className="flex flex-col gap-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mc-mono mb-4 text-[13px] text-ink">
        {number} · {title}
      </h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-label">
        {children}
      </div>
    </section>
  );
}
