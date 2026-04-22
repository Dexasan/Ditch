import { spawn, type ChildProcess } from "child_process";
import ffmpegStatic from "ffmpeg-static";

const FFMPEG_BIN = ffmpegStatic ?? "ffmpeg";

export interface FfmpegSession {
  write: (chunk: Buffer) => void;
  stop: () => void;
  onExit: (cb: (code: number | null) => void) => void;
  onError: (cb: (err: Error) => void) => void;
}

export function spawnFfmpeg(rtmpTargets: string[]): FfmpegSession {
  const args = buildArgs(rtmpTargets);
  const proc: ChildProcess = spawn(FFMPEG_BIN, args, { stdio: ["pipe", "ignore", "pipe"] });

  proc.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

  return {
    write(chunk: Buffer) {
      if (proc.stdin && !proc.stdin.destroyed) proc.stdin.write(chunk);
    },
    stop() {
      if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
    },
    onExit(cb) {
      proc.on("exit", (code) => cb(code));
    },
    onError(cb) {
      proc.on("error", cb);
    },
  };
}

function buildArgs(targets: string[]): string[] {
  const inputFlags = [
    "-fflags", "nobuffer",
    "-f", "webm",
    "-i", "pipe:0",
  ];

  const encodeFlags = [
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
  ];

  if (targets.length === 1) {
    return [...inputFlags, ...encodeFlags, "-f", "flv", targets[0]];
  }

  // Tee muxer: encode once, push to all destinations simultaneously.
  // onfail=ignore keeps remaining destinations alive if one drops.
  const tee = targets.map((t) => `[onfail=ignore:f=flv]${t}`).join("|");
  return [...inputFlags, ...encodeFlags, "-f", "tee", "-map", "0:v", "-map", "0:a", tee];
}
