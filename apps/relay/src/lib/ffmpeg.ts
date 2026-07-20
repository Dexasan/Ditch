import { spawn, execSync, type ChildProcess } from "child_process";
import { existsSync } from "fs";

// Prefer the system/PATH ffmpeg (Nixpacks, apt, apk) over the static vendor
// binary. The johnvansickle.com static build reliably SIGSEGVs on Railway after
// input detection — the Nix-installed binary does not. We use `which` to find
// whatever is in PATH before falling back to well-known absolute paths, and only
// use vendor/ffmpeg as a last resort.
function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  try {
    const found = execSync("which ffmpeg 2>/dev/null", { encoding: "utf8" }).trim();
    if (found) return found;
  } catch (_) {}

  const candidates = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "vendor/ffmpeg",  // last resort: static binary, known to SIGSEGV on Railway
  ];
  return candidates.find(existsSync) ?? "ffmpeg";
}

const FFMPEG_BIN = resolveFfmpeg();
console.log("[ffmpeg] resolved binary:", FFMPEG_BIN);

export interface FfmpegSession {
  write: (chunk: Buffer) => boolean;
  stop: () => void;
  onDrain: (cb: () => void) => void;
  onExit: (cb: (code: number | null, signal: string | null) => void) => void;
  onError: (cb: (err: Error) => void) => void;
}

export type EncoderPreset = "quality" | "balanced" | "performance";

export interface EncoderParams {
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  preset: EncoderPreset;
  fps: number;
}

export const DEFAULT_ENCODER_PARAMS: EncoderParams = {
  videoBitrateKbps: 3000,
  audioBitrateKbps: 128,
  preset: "balanced",
  fps: 30,
};

const X264_PRESETS: Record<EncoderPreset, string> = {
  quality: "medium",
  balanced: "veryfast",
  performance: "ultrafast",
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Encoder params arrive from the browser in the WS "start" message - clamp
// everything to sane ranges so a tampered client can't drive ffmpeg with
// absurd values.
export function sanitizeEncoderParams(msg: Record<string, unknown>): EncoderParams {
  const preset = msg.encoder_preset;
  return {
    videoBitrateKbps: clampInt(msg.video_bitrate_kbps, 1000, 8000, DEFAULT_ENCODER_PARAMS.videoBitrateKbps),
    audioBitrateKbps: clampInt(msg.audio_bitrate_kbps, 64, 320, DEFAULT_ENCODER_PARAMS.audioBitrateKbps),
    preset: preset === "quality" || preset === "balanced" || preset === "performance"
      ? preset
      : DEFAULT_ENCODER_PARAMS.preset,
    fps: msg.fps === 60 ? 60 : 30,
  };
}

export function spawnFfmpeg(
  rtmpTargets: string[],
  sessionId: string,
  params: EncoderParams = DEFAULT_ENCODER_PARAMS,
  hlsPlaylistPath?: string,
): FfmpegSession {
  const args = buildArgs(rtmpTargets, params, hlsPlaylistPath);
  const tag = `[ffmpeg ${sessionId.slice(0, 8)}]`;

  console.log(tag, "spawning:", FFMPEG_BIN, args.join(" "));

  const proc: ChildProcess = spawn(FFMPEG_BIN, args, { stdio: ["pipe", "ignore", "pipe"] });

  proc.stdin?.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") console.error(tag, "stdin error:", err.message);
  });

  const stderrBuf: Buffer[] = [];
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf.push(chunk);
    console.log(tag, chunk.toString().trimEnd());
  });

  let stopped = false;

  return {
    write(chunk: Buffer) {
      if (proc.stdin && !proc.stdin.destroyed) return proc.stdin.write(chunk);
      return true;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      // Closing stdin signals EOF: ffmpeg flushes, ends the RTMP stream cleanly,
      // and the destination (YouTube/Twitch) stops "waiting for encoder".
      if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
      // ffmpeg can hang on a live pipe instead of exiting on EOF — force-kill so
      // the RTMP socket is released and the destination's stream actually ends.
      const killTimer = setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) {
          console.warn(tag, "did not exit on stdin EOF — sending SIGKILL");
          proc.kill("SIGKILL");
        }
      }, 3000);
      proc.once("exit", () => clearTimeout(killTimer));
    },
    onDrain(cb) {
      proc.stdin?.on("drain", cb);
    },
    onExit(cb) {
      proc.on("exit", (code, signal) => {
        if (code !== 0) {
          console.error(tag, "full stderr on exit:\n" + Buffer.concat(stderrBuf).toString());
        }
        cb(code, signal);
      });
    },
    onError(cb) {
      proc.on("error", cb);
    },
  };
}

export function buildArgs(
  targets: string[],
  params: EncoderParams = DEFAULT_ENCODER_PARAMS,
  hlsPlaylistPath?: string,
): string[] {
  const inputFlags = [
    "-fflags", "+nobuffer+genpts",
    "-thread_queue_size", "512",
    "-probesize", "32",
    "-analyzeduration", "0",
    "-f", "webm",
    "-i", "pipe:0",
  ];

  // YouTube and Twitch both require a keyframe every ~2s: YouTube refuses to
  // leave "Preparing stream" without one, Twitch plays but flags the ingest
  // "Keyframe interval too high / UNSTABLE". The browser's MediaRecorder emits
  // keyframes too infrequently (videoKeyFrameIntervalDuration is not honored
  // for H264 in current Chromium) and -c:v copy can't insert them, so
  // keyframe-strict targets share one libx264 re-encode (via tee) with forced
  // 2s keyframes and CFR output. Other targets keep the lossless passthrough
  // in a second output branch of the same process.
  const needsReencode = (t: string) => /youtube|twitch/i.test(t);
  const reencodeTargets = targets.filter(needsReencode);
  const copyTargets = targets.filter((t) => !needsReencode(t));

  // Audio is always transcoded Opus → AAC since RTMP does not carry Opus.
  const audioFlags = [
    "-c:a", "aac",
    "-b:a", `${params.audioBitrateKbps}k`,
    "-ar", "44100",
  ];

  // Pass H264 NAL units from the browser straight into FLV (no re-encode).
  const copyFlags = ["-c:v", "copy", ...audioFlags];

  const reencodeFlags = [
    "-c:v", "libx264",
    "-preset", X264_PRESETS[params.preset],
    "-profile:v", "main",
    "-pix_fmt", "yuv420p",
    // The browser canvas capture is variable-framerate; RTMP ingests expect
    // constant. As an output option -r duplicates/drops frames to hold a
    // constant rate (CFR), regularizing timestamps on static scenes.
    "-r", String(params.fps),
    // Force a keyframe every 2 seconds of wall-clock time (fps-independent).
    "-force_key_frames", "expr:gte(t,n_forced*2)",
    // ...and ONLY every 2 seconds: disable x264 scene-cut so no extra keyframes
    // land between the forced ones. YouTube wants a consistent GOP and can sit
    // in "Preparing stream" forever on an irregular one; Twitch tolerates it.
    "-sc_threshold", "0",
    "-g", String(params.fps * 2),
    "-b:v", `${params.videoBitrateKbps}k`,
    "-maxrate", `${params.videoBitrateKbps}k`,
    "-bufsize", `${params.videoBitrateKbps * 2}k`,
    ...audioFlags,
  ];

  // Flush every packet immediately; skip duration/filesize fields in FLV header
  // (they can't be known for a live stream and cause noisy errors on shutdown).
  const outputFlags = [
    "-flvflags", "no_duration_filesize",
    "-flush_packets", "1",
  ];

  // One output branch per encode policy. A branch with a single target is a
  // plain FLV output; multiple targets share one encode via the tee muxer.
  // Escape any literal `|` in the target URL so it isn't parsed as a tee
  // output separator. Defense-in-depth: the API rejects `|` in stream_key,
  // but we sanitize here too in case data arrives from another path.
  function outputBranch(encodeFlags: string[], branchTargets: string[], includeHls = false): string[] {
    // A missing audio track must not abort graphics-only or muted broadcasts.
    const mapFlags = ["-map", "0:v", "-map", "0:a?"];
    if (branchTargets.length === 1 && !includeHls) {
      return [...mapFlags, ...encodeFlags, ...outputFlags, "-f", "flv", branchTargets[0]];
    }
    const tee = branchTargets.map((t) => `[onfail=ignore:f=flv]${t.replace(/\|/g, "\\|")}`).join("|");
    const outputs = tee ? tee.split("|") : [];
    if (includeHls && hlsPlaylistPath) {
      const segmentPath = hlsPlaylistPath.replace(/index\.m3u8$/, "segment-%09d.ts");
      outputs.push(
        `[onfail=ignore:f=hls:hls_time=2:hls_list_size=8:` +
        `hls_flags=independent_segments+program_date_time:` +
        `hls_segment_filename=${segmentPath}]${hlsPlaylistPath}`,
      );
    }
    const teeWithHls = outputs.join("|");
    return [...mapFlags, ...encodeFlags, ...outputFlags, "-f", "tee", teeWithHls];
  }


  const hasHls = Boolean(hlsPlaylistPath);
  return [
    ...inputFlags,
    ...(copyTargets.length ? outputBranch(copyFlags, copyTargets) : []),
    ...(reencodeTargets.length || hasHls ? outputBranch(reencodeFlags, reencodeTargets, hasHls) : []),
  ];
}
