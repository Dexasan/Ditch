import styles from "./ConsoleLoading.module.css";

export default function ConsoleLoading() {
  return (
    <div className={styles.page} role="status" aria-label="Loading DITCH">
      <div className={styles.header}>
        <span className={styles.logo} />
        <span className={styles.wordmark} />
        <div className={styles.nav}>{Array.from({ length: 5 }).map((_, index) => <i key={index} />)}</div>
      </div>
      <main className={styles.main}>
        <span className={styles.eyebrow} />
        <span className={styles.title} />
        <span className={styles.copy} />
        <div className={styles.cards}>
          <div />
          <div />
        </div>
      </main>
      <span className="sr-only">Loading?</span>
    </div>
  );
}
