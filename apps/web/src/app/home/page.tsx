import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsoleHeader from "@/components/ConsoleHeader";
import HomeActions from "./HomeActions";
import styles from "./home.module.css";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");

  const displayName = session.user.user_metadata?.display_name as string | undefined;
  const firstName = displayName?.trim().split(" ")[0] || "operator";

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <ConsoleHeader active="home" />

      <main className={styles.main}>
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <p className={styles.eyebrow}>
              <span>HOME FEED</span>
              <i />
              System 01 / Ready
            </p>
            <h1>
              Welcome back,
              <strong>{firstName}.</strong>
            </h1>
            <p className={styles.lead}>
              The room is open. Choose what happens next.
            </p>
          </div>

          <div className={styles.readiness} aria-label="Broadcast system status">
            <div className={styles.readinessTop}>
              <span>TX READY</span>
              <div className={styles.meter} aria-hidden="true">
                {Array.from({ length: 14 }).map((_, index) => <i key={index} />)}
              </div>
            </div>
            <div className={styles.readinessBody}>
              <span className={styles.readyLamp} />
              <div>
                <strong>Studio standing by</strong>
                <small>Browser capture / destinations / audience return</small>
              </div>
              <b>100%</b>
            </div>
          </div>
        </section>

        <HomeActions />

        <footer className={styles.telemetry} aria-label="System telemetry">
          <span><i /> Network online</span>
          <span>DITCH / BROADCAST DESK</span>
          <span>Signal path: browser to everywhere</span>
        </footer>
      </main>
    </div>
  );
}
