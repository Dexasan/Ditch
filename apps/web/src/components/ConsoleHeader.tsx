import Image from "next/image";
import Link from "next/link";
import SignOutButton from "@/app/dashboard/SignOutButton";
import styles from "./ConsoleHeader.module.css";

type ConsoleHeaderProps = {
  active: "home" | "studio";
  channelSlug?: string;
  liveControlHref?: string;
};

const NAV_ITEMS = [
  { id: "home", label: "Home", href: "/home" },
  { id: "studio", label: "Studio", href: "/dashboard" },
  { id: "explore", label: "Explore", href: "/explore" },
] as const;

export default function ConsoleHeader({
  active,
  channelSlug,
  liveControlHref,
}: ConsoleHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/home" className={styles.brand} aria-label="DITCH home">
          <span className={styles.logoFrame}>
            <Image src="/logo.png" alt="" width={32} height={32} priority />
          </span>
          <span className={styles.wordmark}>
            <strong>DITCH</strong>
            <small>Broadcast network</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Account navigation">
          {NAV_ITEMS.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={styles.navLink}
              data-active={active === item.id ? "true" : "false"}
            >
              <span>0{index + 1}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          {channelSlug && (
            <Link href={`/c/${channelSlug}`} className={styles.channelLink}>
              <span className={styles.signalDot} />
              <span className={styles.channelLabel}>View channel</span>
            </Link>
          )}
          {liveControlHref && (
            <Link href={liveControlHref} className={styles.liveButton}>
              Control room
              <ArrowIcon />
            </Link>
          )}
          <SignOutButton className={styles.signOut} />
        </div>
      </div>
    </header>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2.5 9h12M10 4.5 14.5 9 10 13.5" />
    </svg>
  );
}
