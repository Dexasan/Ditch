"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";
import type { StreamPlatform } from "@ditch/types";
import { readDisabled, writeDisabled } from "./destinationSelection";

const PLATFORMS: StreamPlatform[] = ["twitch", "youtube", "tiktok", "kick", "ditch"];

const PLATFORM_LABEL: Record<StreamPlatform, string> = {
  twitch:  "Twitch",
  youtube: "YouTube",
  tiktok:  "TikTok",
  kick:    "Kick",
  ditch:   "DITCH",
};

// Default ingest URLs so the creator only has to paste a stream key. TikTok is
// omitted because it issues a per-stream server URL (no stable default).
const PLATFORM_RTMP_URL: Partial<Record<StreamPlatform, string>> = {
  twitch:  "rtmp://live.twitch.tv/live",
  youtube: "rtmp://a.rtmp.youtube.com/live2",
  kick:    "rtmp://ingest.global-contribute.live-video.net/app",
};

// A persistent, channel-level destination. Credentials never come back from
// the API, so the browser only ever sees these safe fields.
export type SavedDestination = {
  id: string;
  channel_id: string;
  platform: StreamPlatform;
  label: string | null;
  channel_ref: string | null;
  created_at: string;
};

// Platforms whose live chat we can read into the unified feed, plus how to
// label the identity field the creator must provide.
const CHANNEL_REF_HINT: Partial<Record<StreamPlatform, { label: string; placeholder: string }>> = {
  twitch:  { label: "Twitch channel name", placeholder: "e.g. shroud" },
  youtube: { label: "YouTube channel ID or @handle", placeholder: "e.g. @MrBeast or UC..." },
};

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function DestinationList({
  channelId,
  initialDestinations,
}: {
  channelId: string;
  initialDestinations: SavedDestination[];
}) {
  const [destinations, setDestinations] = useState<SavedDestination[]>(initialDestinations);
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState<StreamPlatform>("twitch");
  const [rtmpUrl, setRtmpUrl] = useState(PLATFORM_RTMP_URL["twitch"] ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [channelRef, setChannelRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which destinations are turned OFF for the next broadcast (opt-out set).
  const [disabled, setDisabled] = useState<Set<string>>(new Set());

  // Hydrate the toggle state from localStorage on mount (client-only).
  useEffect(() => {
    setDisabled(readDisabled(channelId));
  }, [channelId]);

  // Auto-fill the RTMP URL when the platform changes so the creator usually
  // only needs to paste a stream key.
  useEffect(() => {
    setRtmpUrl(PLATFORM_RTMP_URL[platform] ?? "");
  }, [platform]);

  function toggleEnabled(id: string) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeDisabled(channelId, next);
      return next;
    });
  }

  async function addDestination(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { saved_destination } = await api.post<{ saved_destination: SavedDestination }>(
        "/saved-destinations",
        {
          token: token!,
          body: {
            channel_id: channelId,
            platform,
            rtmp_url: rtmpUrl,
            stream_key: streamKey,
            label: PLATFORM_LABEL[platform],
            channel_ref: channelRef.trim() || undefined,
          },
        },
      );
      setDestinations((prev) => [...prev, saved_destination]);
      setRtmpUrl(PLATFORM_RTMP_URL[platform] ?? "");
      setStreamKey("");
      setChannelRef("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add destination.");
    }
    setLoading(false);
  }

  async function removeDestination(id: string) {
    const token = await getToken();
    try {
      await api.delete(`/saved-destinations/${id}`, { token: token! });
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      setDisabled((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        writeDisabled(channelId, next);
        return next;
      });
    } catch {
      // silent - destination may already be gone
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

      <p className="text-xs text-[var(--color-text-muted)]">
        Saved once and reused on every stream. Tick which ones to go live to.
      </p>

      {destinations.length === 0 && !adding && (
        <p className="text-sm text-[var(--color-text-muted)]">No destinations yet.</p>
      )}

      <ul className="space-y-2">
        {destinations.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 text-sm py-2 border-b border-[var(--color-surface-border)] last:border-0"
          >
            <input
              type="checkbox"
              checked={!disabled.has(d.id)}
              onChange={() => toggleEnabled(d.id)}
              className="accent-[var(--color-brand)] shrink-0"
            />
            <span className="font-medium flex-1">{d.label ?? PLATFORM_LABEL[d.platform]}</span>
            <button
              onClick={() => removeDestination(d.id)}
              className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors shrink-0"
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
          {CHANNEL_REF_HINT[platform] && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-muted)]">
                {CHANNEL_REF_HINT[platform]!.label}{" "}
                <span className="text-[var(--color-text-muted)] opacity-70">(for combined chat)</span>
              </label>
              <input
                type="text"
                value={channelRef}
                onChange={(e) => setChannelRef(e.target.value)}
                placeholder={CHANNEL_REF_HINT[platform]!.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
              />
            </div>
          )}
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
