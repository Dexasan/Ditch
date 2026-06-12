import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="mc-mono text-[14px] text-ink">ditch</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="mc-mono px-2 py-2 text-[12px] text-tally transition hover:opacity-80"
          >
            sign in
          </Link>
          <Link
            href="/auth"
            className="mc-mono rounded-lg bg-tally px-4 py-2 text-[12px] text-paper transition hover:opacity-90"
          >
            get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
