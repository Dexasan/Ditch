"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";
import type { StreamDestination, StreamPlatform } from "@ditch/types";

const PLATFORMS: StreamPlatform[] = ["twitch", "youtube", "tiktok", "kick", "ditch"];

const PLATFORM_LABEL: Record<StreamPlatform, string> = {
  twitch:  "Twitch",
  youtube: "YouTube",
  tiktok:  "TikTok",
  kick:    "Kick",
  ditch:   "DITCH",
};

const STATUS_COLOR: Record<string, string> = {
  idle:       "text-zinc-400",
  connecting: "text-yellow-400",
  live:       "text-green-400",
  error:      "text-red-400",
  stopped:    "text-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  idle:       "Ready",
  connecting: "Connecting",
  live:       "Live",
  error:      "Error",
  stopped:    "Stopped",
};

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function DestinationList({
  sessionId,
  initialDestinations,
}: {
  sessionId: string;
  initialDestinations: StreamDestination[];
}) {
  const [destinations, setDestinations] = useState<StreamDestination[]>(initialDestinations);
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState<StreamPlatform>("twitch");
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addDestination(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { destination } = await api.post<{ destination: StreamDestination }>("/destinations", {
        token: token!,
        body: { session_id: sessionId, platform, rtmp_url: rtmpUrl, stream_key: streamKey },
      });
      setDestinations((prev) => [...prev, destination]);
      setRtmpUrl("");
      setStreamKey("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add destination.");
    }
    setLoading(false);
  }

  async function removeDestination(id: string) {
    const token = await getToken();
    try {
      await api.delete(`/destinations/${id}`, { token: token! });
      setDestinations((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // silent — destination may already be gone
    }
  }

  return (
    <div className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-[var(--color-text-muted)] uppercase tracking-wider">
          Destinations
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-[var(--color-brand-light)] hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {destinations.length === 0 && !adding && (
        <p className="text-sm text-[var(--color-text-muted)]">No destinations yet.</p>
      )}

      <ul className="space-y-2">
        {destinations.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between text-sm py-2 border-b border-[var(--color-surface-border)] last:border-0"
          >
            <div className="space-y-0.5">
              <span className="font-medium">{PLATFORM_LABEL[d.platform]}</span>
              <p className={`text-xs ${STATUS_COLOR[d.status] ?? "text-zinc-400"}`}>
                {STATUS_LABEL[d.status] ?? d.status}
              </p>
            </div>
            <button
              onClick={() => removeDestination(d.id)}
              className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <form onSubmit={addDestination} className="space-y-3 pt-2 border-t border-[var(--color-surface-border)]">
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-text-muted)]">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as StreamPlatform)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-text-muted)]">RTMP URL</label>
            <input
              type="text"
              required
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://live.twitch.tv/app"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-text-muted)]">Stream key</label>
            <input
              type="password"
              required
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); }}
              className="px-4 py-2 rounded-lg border border-[var(--color-surface-border)] text-sm transition-colors hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
