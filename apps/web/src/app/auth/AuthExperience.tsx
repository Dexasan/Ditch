"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import styles from "./auth.module.css";

type Mode = "signin" | "signup";

export default function AuthExperience() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSignedUp(true);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/home");
        router.refresh();
      }
    }

    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSignedUp(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.cornerMarks} aria-hidden="true"><i /><i /><i /><i /></div>

      <section className={styles.access}>
        <div className={styles.accessPanel}>
          <div className={styles.panelTop}>
            <span>DITCH ID</span>
            <span>SECURE ACCESS / TLS</span>
          </div>

          {signedUp ? (
            <div className={styles.confirmation} aria-live="polite">
              <div className={styles.mailGlyph}>
                <MailIcon />
                <span />
              </div>
              <p className={styles.eyebrow}>TRANSMISSION SENT</p>
              <h1>Check your inbox.</h1>
              <p>
                A confirmation link is heading to <strong>{email}</strong>.
                Open it to claim your account, then return here to sign in.
              </p>
              <button type="button" onClick={() => switchMode("signin")} className={styles.secondaryButton}>
                Back to sign in
                <ArrowIcon />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.formIntro}>
                <p className={styles.eyebrow}>
                  {mode === "signin" ? "WELCOME BACK / OPERATOR" : "NEW CHANNEL / START HERE"}
                </p>
                <h2>{mode === "signin" ? "Enter the network." : "Claim your frequency."}</h2>
                <p>
                  {mode === "signin"
                    ? "Your room is right where you left it."
                    : "Free during public beta. No card required."}
                </p>
              </div>

              <div className={styles.modeSwitch} role="tablist" aria-label="Account mode">
                {(["signin", "signup"] as Mode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={mode === item}
                    onClick={() => switchMode(item)}
                    data-active={mode === item ? "true" : "false"}
                  >
                    <span>{item === "signin" ? "01" : "02"}</span>
                    {item === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <label className={styles.field}>
                  <span>Email address</span>
                  <div>
                    <MailSmallIcon />
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="operator@yourshow.com"
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Password</span>
                  <div>
                    <LockIcon />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="8 characters minimum"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className={styles.showPassword}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </label>

                {error && <p className={styles.error} role="alert">{error}</p>}

                <button type="submit" disabled={loading} className={styles.submit}>
                  <span>{loading ? "CONTACTING NETWORK..." : mode === "signin" ? "ENTER DITCH" : "CREATE MY ACCOUNT"}</span>
                  <ArrowIcon />
                </button>
              </form>

              <p className={styles.legal}>
                By continuing, you agree to the <Link href="/terms">Terms</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>

        <div className={styles.accessFooter}>
          <span><i /> Auth gateway online</span>
          <span>ROME / GLOBAL</span>
        </div>
      </section>
    </main>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10h14M11.5 5l5 5-5 5" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" /><path d="m4 9 12 9L28 9" /></svg>;
}

function MailSmallIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" /><path d="m3 6 7 5 7-5" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" /><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" /></svg>;
}
