"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";
import type { LiveSession, SessionStatus } from "@ditch/types";

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle:   "Ready",
  live:   "Live",
  ending: "Ending",
  ended:  "Ended",
};

const STATUS_DOT: Record<SessionStatus, string> = {
  idle:   "bg-yellow-500",
  live:   "bg-green-500 animate-pulse",
  ending: "bg-orange-500",
  ended:  "bg-zinc-500",
};

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function SessionPanel({
  channelId,
  channelSlug,
  initialSession,
}: {
  channelId: string;
  channelSlug: string;
  initialSession: LiveSession | null;
}) {
  const router = useRouter();
  const [session, setSession] = useState<LiveSession | null>(initialSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: s } = await api.post<{ session: LiveSession }>("/sessions", {
        token: token!,
        body: { channel_id: channelId },
      });
      setSession(s);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start session.");
    }
    setLoading(false);
  }

  async function transitionSession(status: SessionStatus) {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: s } = await api.patch<{ session: LiveSession }>(`/sessions/${session.id}`, {
        token: token!,
        body: { status },
      });
      setSession(s);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update session.");
    }
    setLoading(false);
  }

  async function endSession() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: s } = await api.delete<{ session: LiveSession }>(`/sessions/${session.id}`, {
        token: token!,
      });
      setSession(s);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to end session.");
    }
    setLoading(false);
  }

  const status = session?.status ?? null;

  return (
    <div className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-[var(--color-text-muted)] uppercase tracking-wider">
          Session
        </h2>
        {status && status !== "ended" && (
          <span className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div className="text-xs text-[var(--color-text-muted)]">
        Channel URL:{" "}
        <span className="text-[var(--color-text)]">ditch.live/c/{channelSlug}</span>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {!session || status === "ended" ? (
          <button
            onClick={startSession}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start session"}
          </button>
        ) : (
          <>
            {status === "idle" && (
              <button
                onClick={async () => {
                  await transitionSession("live");
                  router.push(`/c/${channelSlug}/live`);
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Go live →"}
              </button>
            )}
            {status === "live" && (
              <button
                onClick={() => transitionSession("ending")}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Start ending"}
              </button>
            )}
            <button
              onClick={endSession}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] hover:border-red-500 text-red-400 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Force end"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
