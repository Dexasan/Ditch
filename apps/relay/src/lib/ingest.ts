import { createHash } from "node:crypto";
import NodeMediaServer, { type NodeMediaSession } from "node-media-server";
import { supabaseAdmin } from "@ditch/db";
import { spawnRtmpIngest, type FfmpegSession } from "./ffmpeg.js";
import { createHlsPublisher, isHlsConfigured, type HlsPublisher } from "./hls.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_POLL_MS = 5000;

type ActiveIngest = {
  publisher: NodeMediaSession;
  ffmpeg: FfmpegSession;
  hls: HlsPublisher | null;
};

export interface RtmpIngestController {
  activeCount: () => number;
}

function signStreamPath(path: string, expires: number, secret: string) {
  return createHash("md5").update(`${path}-${expires}-${secret}`).digest("hex");
}

export function startRtmpIngest(options: {
  activeSessions: Map<string, FfmpegSession>;
  maxActiveStreams: number;
}): RtmpIngestController | null {
  if (process.env.RTMP_INGEST_ENABLED !== "true") return null;

  const secret = process.env.INGEST_AUTH_SECRET!.trim();
  const port = Math.min(65535, Math.max(1, Number(process.env.RTMP_INGEST_PORT) || 1935));
  const external = new Map<string, ActiveIngest>();
  const publisherToSession = new Map<string, string>();

  const nms = new NodeMediaServer({
    bind: "0.0.0.0",
    rtmp: { port },
    auth: { publish: true, play: true, secret },
  });

  async function markEnded(sessionId: string) {
    await supabaseAdmin!
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .neq("status", "ended");
  }

  async function stop(sessionId: string, closePublisher: boolean, endSession: boolean) {
    const active = external.get(sessionId);
    if (!active) return;
    external.delete(sessionId);
    publisherToSession.delete(active.publisher.id);
    options.activeSessions.delete(sessionId);
    active.ffmpeg.stop();
    void active.hls?.stop();
    if (closePublisher) active.publisher.close();
    if (endSession) await markEnded(sessionId);
    console.log(`[ingest] session ${sessionId} stopped`);
  }

  nms.on("postPublish", (publisher) => {
    void (async () => {
      const sessionId = publisher.streamName;
      if (publisher.streamApp !== "live" || !UUID_PATTERN.test(sessionId)) {
        publisher.close();
        return;
      }

      type IngestSession = {
        id: string;
        status: "idle" | "live" | "ending" | "ended";
        source_type: "browser" | "rtmp";
        started_at: string | null;
      };
      const [{ data: rawSession }, { data: destinations }] = await Promise.all([
        supabaseAdmin!
          .from("live_sessions")
          .select("id, status, source_type, started_at")
          .eq("id", sessionId)
          .maybeSingle(),
        supabaseAdmin!
          .from("stream_destinations")
          .select("rtmp_url, stream_key")
          .eq("session_id", sessionId),
      ]);
      const session = rawSession as IngestSession | null;
      if (!session || session.source_type !== "rtmp" || !["idle", "live"].includes(session.status)) {
        publisher.close();
        return;
      }
      if (!destinations?.length && !isHlsConfigured()) {
        console.warn(`[ingest] session ${sessionId} rejected: no outputs configured`);
        publisher.close();
        return;
      }
      if (options.activeSessions.has(sessionId) || options.activeSessions.size >= options.maxActiveStreams) {
        console.warn(`[ingest] session ${sessionId} rejected: relay is at capacity or already active`);
        publisher.close();
        return;
      }

      const targets = (destinations ?? []).map((destination) =>
        `${destination.rtmp_url}/${destination.stream_key}`
      );
      let hls: HlsPublisher | null = null;
      try {
        hls = await createHlsPublisher(sessionId);
        // Play authentication is also enabled, so the local ffmpeg reader gets a
        // separate short-lived signature. Expiry is checked only at connect.
        const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        const path = `/live/${sessionId}`;
        const signature = signStreamPath(path, expires, secret);
        const inputUrl = `rtmp://127.0.0.1:${port}${path}?sign=${expires}-${signature}`;
        const ffmpeg = spawnRtmpIngest(targets, sessionId, inputUrl, hls?.playlistPath);
        const active = { publisher, ffmpeg, hls };
        external.set(sessionId, active);
        publisherToSession.set(publisher.id, sessionId);
        options.activeSessions.set(sessionId, ffmpeg);

        ffmpeg.onError((error) => {
          console.error(`[ingest] ffmpeg error for ${sessionId}:`, error.message);
          void stop(sessionId, true, true);
        });
        ffmpeg.onExit((code, signal) => {
          if (external.has(sessionId)) {
            console.log(`[ingest] ffmpeg exited for ${sessionId}: code=${code}, signal=${signal}`);
            void stop(sessionId, true, true);
          }
        });

        const { error: updateError } = await supabaseAdmin!
          .from("live_sessions")
          .update({
            status: "live",
            started_at: session.started_at ?? new Date().toISOString(),
          })
          .eq("id", sessionId)
          .in("status", ["idle", "live"]);
        if (updateError) {
          console.error(`[ingest] failed to mark ${sessionId} live:`, updateError.message);
          await stop(sessionId, true, true);
          return;
        }
        console.log(`[ingest] session ${sessionId} live from RTMP to ${targets.length} destination(s)`);
      } catch (error) {
        void hls?.stop();
        publisher.close();
        console.error(`[ingest] failed to start ${sessionId}:`, error);
      }
    })();
  });

  nms.on("donePublish", (publisher) => {
    const sessionId = publisherToSession.get(publisher.id);
    if (sessionId) void stop(sessionId, false, true);
  });

  setInterval(() => {
    for (const [sessionId] of external) {
      void (async () => {
        const { data } = await supabaseAdmin!
          .from("live_sessions")
          .select("status")
          .eq("id", sessionId)
          .maybeSingle();
        if (!data || data.status === "ended") await stop(sessionId, true, false);
      })();
    }
  }, STATUS_POLL_MS).unref();

  nms.run();
  console.log(`[ingest] RTMP listener enabled on port ${port}`);
  return { activeCount: () => external.size };
}