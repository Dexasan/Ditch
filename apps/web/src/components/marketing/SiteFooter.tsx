import Image from "next/image";
import Link from "next/link";
import { SMPTE_GRADIENT } from "./palette";

// TODO(founder): add real social profiles when the handles exist. Do not
// ship dead "#" links; the row below only renders what is real.
const CONTACT_EMAIL = "sendmailtodex@gmail.com";

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-line">
      {/* sign-off: a test strip and an off-air lamp end the broadcast day */}
      <div className="h-[5px] w-full" style={{ backgroundImage: SMPTE_GRADIENT }} aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="mc-mono flex items-center gap-2 text-[11px] text-faint">
          <span className="h-2 w-2 rounded-full bg-line" aria-hidden="true" />
          off air
        </div>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={22}
              height={22}
              className="rounded"
            />
            <span className="mc-mono text-[13px] text-ink">ditch</span>
          </span>
          <nav aria-label="footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/terms"
              className="mc-mono text-[12px] text-label transition hover:text-ink"
            >
              terms
            </Link>
            <Link
              href="/privacy"
              className="mc-mono text-[12px] text-label transition hover:text-ink"
            >
              privacy
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mc-mono text-[12px] text-label transition hover:text-ink"
            >
              contact
            </a>
          </nav>
        </div>
        <div className="mc-mono flex flex-col items-start justify-between gap-2 text-[11px] text-faint sm:flex-row sm:items-center">
          <span>ditch · rome</span>
          <span>© 2026 ditch. all rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
