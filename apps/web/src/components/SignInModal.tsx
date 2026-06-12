"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

interface SignInModalProps {
  onSuccess: (token: string, displayName: string) => void;
  onClose: () => void;
  /** Current draft message - shown in the input so the user remembers what they were typing. */
  initialDraft: string;
  onDraftChange: (value: string) => void;
}

export default function SignInModal({
  onSuccess,
  onClose,
  initialDraft,
  onDraftChange,
}: SignInModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on mount.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Re-focus first input when switching modes.
  useEffect(() => {
    setError(null);
    firstInputRef.current?.focus();
  }, [mode]);

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
          data: { display_name: displayName.trim() },
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSignedUp(true);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        const name =
          (data.user.user_metadata?.display_name as string | undefined) ??
          data.user.email?.split("@")[0] ??
          "Viewer";
        onSuccess(data.session.access_token, name);
      }
    }

    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSignedUp(false);
  }

  return (
    // Backdrop - click outside to dismiss.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Card - stop propagation so clicks inside don't close the modal. */}
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-surface-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {signedUp ? (
          // ── Email verification sent ───────────────────────────────────────
          <div className="p-6 text-center space-y-4">
            <div className="text-3xl">📬</div>
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="text-[var(--color-text)]">{email}</span>.
              Click it to activate your account, then sign in here.
            </p>
            {initialDraft && (
              <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] rounded-lg px-3 py-2">
                Your message <span className="text-[var(--color-text)]">"{initialDraft}"</span> will be here when you're back.
              </p>
            )}
            <button
              onClick={() => switchMode("signin")}
              className="text-sm text-[var(--color-brand-light)] hover:underline"
            >
              Sign in instead
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[var(--color-surface-border)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Sign in to chat</p>
                <button
                  onClick={onClose}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {/* Mode tabs */}
              <div className="flex rounded-lg bg-[var(--color-surface-raised)] p-0.5">
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={[
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                      mode === m
                        ? "bg-[var(--color-surface)] text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                    ].join(" ")}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-text-muted)]" htmlFor="modal-display-name">
                    Display name
                  </label>
                  <input
                    ref={firstInputRef}
                    id="modal-display-name"
                    type="text"
                    required
                    maxLength={64}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you'll appear in chat"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-[var(--color-text-muted)]" htmlFor="modal-email">
                  Email
                </label>
                <input
                  ref={mode === "signin" ? firstInputRef : undefined}
                  id="modal-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[var(--color-text-muted)]" htmlFor="modal-password">
                  Password
                </label>
                <input
                  id="modal-password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>

              {/* Draft reminder */}
              {initialDraft && (
                <p className="text-[11px] text-[var(--color-text-muted)] text-center">
                  Your message "{initialDraft}" will be sent after sign in.
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
