"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";
import type { StreamPlatform } from "@ditch/types";
import { readDisabled, writeDisabled } from "./destinationSelection";
import styles from "./dashboard.module.css";

const PLATFORMS: StreamPlatform[] = ["twitch", "youtube", "tiktok", "kick", "ditch"];

const PLATFORM_LABEL: Record<StreamPlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
  kick: "Kick",
  ditch: "DITCH",
};

const PLATFORM_CODE: Record<StreamPlatform, string> = {
  twitch: "TW",
  youtube: "YT",
  tiktok: "TK",
  kick: "KI",
  ditch: "DI",
};

const PLATFORM_RTMP_URL: Partial<Record<StreamPlatform, string>> = {
  twitch: "rtmp://live.twitch.tv/live",
  youtube: "rtmp://a.rtmp.youtube.com/live2",
  kick: "rtmp://ingest.global-contribute.live-video.net/app",
};

export type SavedDestination = {
  id: string;
  channel_id: string;
  platform: StreamPlatform;
  label: string | null;
  channel_ref: string | null;
  created_at: string;
};

const CHANNEL_REF_HINT: Partial<Record<StreamPlatform, { label: string; placeholder: string }>> = {
  twitch: { label: "Twitch channel name", placeholder: "e.g. shroud" },
  youtube: { label: "YouTube channel ID or @handle", placeholder: "e.g. @MrBeast or UC..." },
};

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function DestinationConsole({
  channelId,
  initialDestinations,
}: {
  channelId: string;
  initialDestinations: SavedDestination[];
}) {
  const [destinations, setDestinations] = useState<SavedDestination[]>(initialDestinations);
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState<StreamPlatform>("twitch");
  const [rtmpUrl, setRtmpUrl] = useState(PLATFORM_RTMP_URL.twitch ?? "");
  const [streamKey, setStreamKey] = useState("");
  const [channelRef, setChannelRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDisabled(readDisabled(channelId));
  }, [channelId]);

  useEffect(() => {
    setRtmpUrl(PLATFORM_RTMP_URL[platform] ?? "");
  }, [platform]);

  function toggleEnabled(id: string) {
    setDisabled((previous) => {
      const next = new Set<string>(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeDisabled(channelId, next);
      return next;
    });
  }

  async function addDestination(event: React.FormEvent) {
    event.preventDefault();
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
      setDestinations((previous) => [...previous, saved_destination]);
      setRtmpUrl(PLATFORM_RTMP_URL[platform] ?? "");
      setStreamKey("");
      setChannelRef("");
      setAdding(false);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Failed to add destination.");
    }
    setLoading(false);
  }

  async function removeDestination(id: string) {
    const token = await getToken();
    try {
      await api.delete(`/saved-destinations/${id}`, { token: token! });
      setDestinations((previous) => previous.filter((destination) => destination.id !== id));
      setDisabled((previous) => {
        if (!previous.has(id)) return previous;
        const next = new Set<string>(previous);
        next.delete(id);
        writeDisabled(channelId, next);
        return next;
      });
    } catch {
      // The destination may already have been removed by another client.
    }
  }

  const enabledCount = destinations.filter((destination) => !disabled.has(destination.id)).length;

  return (
    <section className={`${styles.panel} ${styles.destinationPanel}`}>
      <div className={styles.panelChrome}>
        <div>
          <span>02</span>
          <strong>Signal destinations</strong>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={styles.addDestination}>
            <PlusIcon />
            Add output
          </button>
        )}
      </div>

      <div className={styles.destinationSummary}>
        <div>
          <p className={styles.monoLabel}>OUTPUT PATCH BAY</p>
          <h2>{enabledCount.toString().padStart(2, "0")} armed</h2>
        </div>
        <span>{destinations.length.toString().padStart(2, "0")} saved</span>
      </div>

      <p className={styles.destinationHelp}>
        Saved once, ready for every broadcast. Arm only the outputs you want for the next show.
      </p>

      {!adding && destinations.length === 0 && (
        <button type="button" className={styles.emptyDestinations} onClick={() => setAdding(true)}>
          <span className={styles.emptyPatch}><i /><i /><i /></span>
          <strong>No outputs patched yet</strong>
          <small>Add your first stream destination</small>
        </button>
      )}

      <ul className={styles.destinationList}>
        {destinations.map((destination) => {
          const enabled = !disabled.has(destination.id);
          return (
            <li key={destination.id} data-enabled={enabled ? "true" : "false"}>
              <span className={styles.platformIcon} data-platform={destination.platform}>
                {PLATFORM_CODE[destination.platform]}
              </span>
              <div className={styles.destinationIdentity}>
                <strong>{destination.label ?? PLATFORM_LABEL[destination.platform]}</strong>
                <small>{enabled ? "Armed for next broadcast" : "Output bypassed"}</small>
              </div>
              <label className={styles.outputToggle}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleEnabled(destination.id)}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${destination.label ?? PLATFORM_LABEL[destination.platform]}`}
                />
                <span><i /></span>
                <b>{enabled ? "ON" : "OFF"}</b>
              </label>
              <button
                type="button"
                onClick={() => removeDestination(destination.id)}
                className={styles.removeDestination}
                aria-label={`Remove ${destination.label ?? PLATFORM_LABEL[destination.platform]}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      {adding && (
        <form onSubmit={addDestination} className={styles.destinationForm}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.monoLabel}>NEW OUTPUT / CREDENTIALS</p>
              <h3>Patch a destination</h3>
            </div>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} aria-label="Close destination form">
              <CloseIcon />
            </button>
          </div>

          <label className={styles.formField}>
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as StreamPlatform)}>
              {PLATFORMS.map((item) => (
                <option key={item} value={item}>{PLATFORM_LABEL[item]}</option>
              ))}
            </select>
          </label>

          <label className={styles.formField}>
            <span>RTMP URL</span>
            <input
              type="text"
              required
              value={rtmpUrl}
              onChange={(event) => setRtmpUrl(event.target.value)}
              placeholder="rtmp://live.twitch.tv/app"
            />
          </label>

          <label className={styles.formField}>
            <span>Stream key</span>
            <input
              type="password"
              required
              value={streamKey}
              onChange={(event) => setStreamKey(event.target.value)}
              placeholder="Stored securely and never returned"
            />
          </label>

          {CHANNEL_REF_HINT[platform] && (
            <label className={styles.formField}>
              <span>{CHANNEL_REF_HINT[platform]!.label} <em>/ for combined chat</em></span>
              <input
                type="text"
                value={channelRef}
                onChange={(event) => setChannelRef(event.target.value)}
                placeholder={CHANNEL_REF_HINT[platform]!.placeholder}
              />
            </label>
          )}

          {error && <p className={styles.panelError} role="alert">{error}</p>}

          <div className={styles.formActions}>
            <button type="submit" disabled={loading} className={styles.primaryAction}>
              <span>{loading ? "Patching output..." : "Save destination"}</span>
              <ArrowIcon />
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className={styles.cancelAction}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3v12M3 9h12" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="m4 4 10 10M14 4 4 14" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h13M10 4l5 5-5 5" /></svg>;
}
