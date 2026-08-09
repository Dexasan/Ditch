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
              <span>YOUR DITCH</span>
              <i />
              Pick up where you left off
            </p>
            <h1>
              Welcome back,
              <strong>{firstName}.</strong>
            </h1>
            <p className={styles.lead}>
              The room is open. Choose what happens next.
            </p>
          </div>

        </section>

        <HomeActions />

      </main>
    </div>
  );
}
