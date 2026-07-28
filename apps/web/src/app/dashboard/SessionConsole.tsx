"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";
import type { IngestCredentials, LiveSession, SessionSource, SessionStatus } from "@ditch/types";
import { readDisabled } from "./destinationSelection";
import styles from "./dashboard.module.css";

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: "Ready",
  live: "Live",
  ending: "Ending",
  ended: "Ended",
};

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function SessionConsole({
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
  const [credentials, setCredentials] = useState<IngestCredentials | null>(null);
  const [copied, setCopied] = useState<"server" | "key" | null>(null);

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: nextSession } = await api.post<{ session: LiveSession }>("/sessions", {
        token: token!,
        body: { channel_id: channelId },
      });
      setSession(nextSession);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Failed to start session.");
    }
    setLoading(false);
  }

  async function applySavedDestinations(sessionId: string): Promise<number> {
    const token = await getToken();
    const { saved_destinations } = await api.get<{ saved_destinations: { id: string }[] }>(
      `/saved-destinations?channel_id=${channelId}`,
      { token: token! },
    );
    const disabled = readDisabled(channelId);
    const ids = saved_destinations.map((destination) => destination.id).filter((id) => !disabled.has(id));
    if (ids.length === 0) return 0;
    await api.post(`/sessions/${sessionId}/apply-destinations`, {
      token: token!,
      body: { saved_destination_ids: ids },
    });
    return ids.length;
  }

  async function transitionSession(status: SessionStatus, source_type?: SessionSource) {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: nextSession } = await api.patch<{ session: LiveSession }>(`/sessions/${session.id}`, {
        token: token!,
        body: { status, ...(source_type ? { source_type } : {}) },
      });
      setSession(nextSession);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Failed to update session.");
    }
    setLoading(false);
  }

  async function armExternalIngest() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const count = await applySavedDestinations(session.id);
      if (count === 0) {
        setError("Select at least one destination before creating an ingest key.");
        setLoading(false);
        return;
      }
      const token = await getToken();
      const response = await api.post<{ credentials: IngestCredentials }>(
        `/sessions/${session.id}/ingest-credentials`,
        { token: token!, body: {} },
      );
      setCredentials(response.credentials);
      setSession((current) => current ? { ...current, source_type: "rtmp" } : current);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Failed to arm RTMP ingest.");
    }
    setLoading(false);
  }

  async function copyCredential(kind: "server" | "key", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1600);
    } catch {
      setError("Clipboard access was blocked. Select and copy the value manually.");
    }
  }

  async function endSession() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const { session: nextSession } = await api.delete<{ session: LiveSession }>(`/sessions/${session.id}`, {
        token: token!,
      });
      setSession(nextSession);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Failed to end session.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!session || session.source_type !== "rtmp" || session.status === "ended") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const token = await getToken();
        const { session: nextSession } = await api.get<{ session: LiveSession }>(
          `/sessions/${session.id}`,
          { token: token! },
        );
        if (cancelled) return;
        setSession(nextSession);
        if (nextSession.status !== session.status) router.refresh();
      } catch {
        // A transient status poll failure must not discard usable credentials.
      }
    };
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router, session?.id, session?.source_type, session?.status]);

  const status = session?.status ?? null;
  const isActive = Boolean(status && status !== "ended");
  const visibleStatus = status ? STATUS_LABEL[status] : "No session";

  return (
    <section className={`${styles.panel} ${styles.sessionPanel}`} data-status={status ?? "none"}>
      <div className={styles.panelChrome}>
        <div>
          <span>01</span>
          <strong>Broadcast session</strong>
        </div>
        <b className={styles.statusBadge} data-status={status ?? "none"}>
          <i />
          {visibleStatus}
        </b>
      </div>

      <div className={styles.sessionBody}>
        <div className={styles.sessionVisual} aria-hidden="true">
          <div className={styles.recordDisc}>
            <i />
            <span>{status === "live" ? "ON AIR" : "TX"}</span>
          </div>
          <div className={styles.sessionMeters}>
            {Array.from({ length: 24 }).map((_, index) => <i key={index} />)}
          </div>
        </div>

        <div className={styles.sessionCopy}>
          <p className={styles.monoLabel}>PRIMARY TRANSMISSION / {isActive ? "SESSION ARMED" : "STANDING BY"}</p>
          <h2>{status === "live" ? (session?.source_type === "rtmp" ? "Encoder signal acquired." : "The room is live.") : status === "idle" ? (credentials ? "Waiting for encoder." : "Ready for pre-flight.") : "Start a new broadcast."}</h2>
          <p>
            {status === "live"
              ? session?.source_type === "rtmp"
                ? "DITCH is receiving your encoder and forwarding it to every armed output."
                : "Your destinations are receiving the show. Enter the control room to run it."
              : credentials
                ? "Paste the server and stream key into OBS, then start streaming."
                : "Create a session, choose the outputs, then take the browser studio on air."}
          </p>
        </div>
      </div>

      <div className={styles.channelAddress}>
        <span>PUBLIC ROOM</span>
        <a href={`/c/${channelSlug}`}>ditch.live/c/{channelSlug}</a>
        <b>{isActive ? "OPEN" : "READY"}</b>
      </div>

      {credentials && status === "idle" && (
        <div className={styles.ingestCredentials}>
          <div className={styles.ingestHeader}>
            <div>
              <span>EXTERNAL ENCODER / ARMED</span>
              <strong>Connect OBS to DITCH</strong>
            </div>
            <i>WAITING FOR SIGNAL</i>
          </div>
          <label>
            <span>Server</span>
            <div>
              <input readOnly value={credentials.server_url} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => copyCredential("server", credentials.server_url)}>
                {copied === "server" ? "Copied" : "Copy"}
              </button>
            </div>
          </label>
          <label>
            <span>Stream key</span>
            <div>
              <input readOnly type="password" value={credentials.stream_key} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => copyCredential("key", credentials.stream_key)}>
                {copied === "key" ? "Copied" : "Copy"}
              </button>
            </div>
          </label>
          <p>
            Key expires {new Date(credentials.expires_at).toLocaleString()}. Use H.264/AAC and a two-second keyframe interval.
          </p>
        </div>
      )}

      {error && <p className={styles.panelError} role="alert">{error}</p>}

      <div className={styles.sessionActions}>
        {!session || status === "ended" ? (
          <button type="button" onClick={startSession} disabled={loading} className={styles.primaryAction}>
            <span>{loading ? "Starting session..." : "Start new session"}</span>
            <ArrowIcon />
          </button>
        ) : (
          <>
            {status === "idle" && (
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const count = await applySavedDestinations(session.id);
                    if (count === 0) {
                      setError("Select at least one destination before going live.");
                      setLoading(false);
                      return;
                    }
                  } catch (requestError) {
                    setError(requestError instanceof ApiError ? requestError.message : "Failed to apply destinations.");
                    setLoading(false);
                    return;
                  }
                  await transitionSession("live", "browser");
                  router.push(`/c/${channelSlug}/live`);
                }}
                disabled={loading}
                className={styles.goLiveAction}
              >
                <span>{loading ? "Arming outputs..." : "Go live"}</span>
                <BroadcastIcon />
              </button>
            )}
            {status === "idle" && !credentials && (
              <button
                type="button"
                onClick={armExternalIngest}
                disabled={loading}
                className={styles.warningAction}
              >
                {loading ? "Creating key..." : "Use OBS / encoder"}
              </button>
            )}
            {status === "live" && (
              <button
                type="button"
                onClick={() => transitionSession("ending")}
                disabled={loading}
                className={styles.warningAction}
              >
                {loading ? "Updating..." : "Start ending"}
              </button>
            )}
            <button type="button" onClick={endSession} disabled={loading} className={styles.dangerAction}>
              {loading ? "Ending..." : "Force end"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h13M10 4l5 5-5 5" /></svg>;
}

function BroadcastIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2" /><path d="M6.2 13.8a5.4 5.4 0 0 1 0-7.6M13.8 6.2a5.4 5.4 0 0 1 0 7.6M3.2 16.8a9.6 9.6 0 0 1 0-13.6M16.8 3.2a9.6 9.6 0 0 1 0 13.6" /></svg>;
}
