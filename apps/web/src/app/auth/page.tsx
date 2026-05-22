"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSignedUp(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
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

  if (signedUp) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
            We sent a confirmation link to <span className="text-[var(--color-text)]">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <button
            onClick={() => switchMode("signin")}
            className="text-[var(--color-brand-light)] text-sm hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <img src="/logo.png" alt="DITCH" className="h-14 w-14 rounded-xl" />
          </div>
          <p className="text-[var(--color-text-muted)] text-sm">
            {mode === "signin" ? "Welcome back." : "Create your account."}
          </p>
        </div>

        <div className="flex rounded-lg bg-[var(--color-surface-raised)] p-1">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={[
                "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                mode === m
                  ? "bg-[var(--color-surface)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              ].join(" ")}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-text-muted)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[var(--color-text-muted)]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
