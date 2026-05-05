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
  write: (chunk: Buffer) => void;
  stop: () => void;
  onExit: (cb: (code: number | null, signal: string | null) => void) => void;
  onError: (cb: (err: Error) => void) => void;
}

export function spawnFfmpeg(rtmpTargets: string[], sessionId: string): FfmpegSession {
  const args = buildArgs(rtmpTargets);
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

  return {
    write(chunk: Buffer) {
      if (proc.stdin && !proc.stdin.destroyed) proc.stdin.write(chunk);
    },
    stop() {
      if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
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

function buildArgs(targets: string[]): string[] {
  const inputFlags = [
    "-fflags", "+nobuffer+genpts",
    "-thread_queue_size", "512",
    "-probesize", "32",
    "-analyzeduration", "0",
    "-f", "webm",
    "-i", "pipe:0",
  ];

  // -c:v copy: pass H264 NAL units from the browser directly into FLV without
  // re-encoding. Re-encoding causes generation loss: the browser's encoder
  // aggressively drops bitrate on static scenes, producing a degraded source
  // that a second H264 encode can only make worse.
  // Audio transcoded Opus → AAC since RTMP does not carry Opus.
  const encodeFlags = [
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
  ];

  // Flush every packet immediately; skip duration/filesize fields in FLV header
  // (they can't be known for a live stream and cause noisy errors on shutdown).
  const outputFlags = [
    "-flvflags", "no_duration_filesize",
    "-flush_packets", "1",
  ];

  if (targets.length === 1) {
    return [...inputFlags, ...encodeFlags, ...outputFlags, "-f", "flv", targets[0]];
  }

  // Tee muxer: encode once, push to all destinations simultaneously.
  // Escape any literal `|` in the target URL so it isn't parsed as a tee
  // output separator. Defense-in-depth: the API rejects `|` in stream_key,
  // but we sanitize here too in case data arrives from another path.
  const tee = targets.map((t) => `[onfail=ignore:f=flv]${t.replace(/\|/g, "\\|")}`).join("|");
  return [...inputFlags, ...encodeFlags, ...outputFlags, "-f", "tee", "-map", "0:v", "-map", "0:a", tee];
}
