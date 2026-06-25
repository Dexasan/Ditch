import Image from "next/image";
import Link from "next/link";

// Shared frame for /terms and /privacy. Dark theme, matching the landing
// page. Both documents ship with a visible draft notice until the founder
// signs off on the content.
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
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)] antialiased">
      <LegalHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
        {SHOW_DRAFT_NOTICE && (
          <p className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Draft for founder review. This document is a sensible starting
            point and has not yet been reviewed by counsel.
          </p>
        )}
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-white)]">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          Last updated: {updated}
        </p>
        <div className="mt-12 flex flex-col gap-10">{children}</div>
      </main>
      <LegalFooter />
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
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-white)]">
        <span className="text-[var(--accent-primary)]">{number}</span> · {title}
      </h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
        {children}
      </div>
    </section>
  );
}

function LegalHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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

function LegalFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
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
