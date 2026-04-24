import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";

// Railpack/Nixpacks installs ffmpeg during the build layer but it may not land in
// the spawned-process PATH. Try explicit paths before falling back to PATH lookup.
function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const candidates = [
    "/usr/bin/ffmpeg",        // apt / apk install
    "/usr/local/bin/ffmpeg",  // homebrew / manual install
    "vendor/ffmpeg",          // copied by build script
  ];
  const found = candidates.find(existsSync);
  if (found) return found;
  return "ffmpeg"; // last resort: PATH lookup
}

const FFMPEG_BIN = resolveFfmpeg();
console.log("[ffmpeg] resolved binary:", FFMPEG_BIN);

export interface FfmpegSession {
  write: (chunk: Buffer) => void;
  stop: () => void;
  onExit: (cb: (code: number | null, signal: string | null) => void) => void;
  onError: (cb: (err: Error) => void) => void;
}

export function spawnFfmpeg(rtmpTargets: string[]): FfmpegSession {
  const args = buildArgs(rtmpTargets);

  console.log("[ffmpeg] spawning:", FFMPEG_BIN, args.join(" "));

  const proc: ChildProcess = spawn(FFMPEG_BIN, args, { stdio: ["pipe", "ignore", "pipe"] });

  // Swallow EPIPE — ffmpeg may exit while browser is still sending chunks
  proc.stdin?.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") console.error("[ffmpeg] stdin error:", err.message);
  });

  // Buffer stderr so the full output (including RTMP errors) is flushed before exit
  const stderrBuf: Buffer[] = [];
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf.push(chunk);
    process.stderr.write(chunk);
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
          console.error("[ffmpeg] full stderr on exit:\n" + Buffer.concat(stderrBuf).toString());
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
    "-fflags", "nobuffer",
    "-f", "webm",
    "-i", "pipe:0",
  ];

  // -c:v copy: pass H264 from browser directly into RTMP without re-encoding.
  // Avoids libx264/libvpx JIT compilation which segfaults in Railway containers.
  // Audio must still be transcoded (Opus → AAC) since RTMP doesn't carry Opus.
  const encodeFlags = [
    "-c:v", "copy",
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
