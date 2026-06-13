import Image from "next/image";
import Link from "next/link";
import Timecode from "./Timecode";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-5">
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
          <span className="mc-mono hidden items-center gap-2 text-[11px] text-faint sm:flex">
            <span className="mc-breathe-dot h-2 w-2 rounded-full bg-tally" aria-hidden="true" />
            <Timecode />
          </span>
        </div>
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
