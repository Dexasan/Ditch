import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const require = createRequire(import.meta.url);
const packageEntry = (() => {
  try {
    return require.resolve("node-media-server");
  } catch {
    return resolve(
      repoRoot,
      "node_modules/.pnpm/node-media-server@4.2.8/node_modules/node-media-server/src/index.js",
    );
  }
})();
const packageSource = dirname(packageEntry);
const Context = require(resolve(packageSource, "core/context.js"));
const NodeRtmpServer = require(resolve(packageSource, "server/rtmp_server.js"));

const port = Number(process.env.RTMP_SMOKE_PORT ?? 11935);
const host = process.env.RTMP_SMOKE_HOST ?? "127.0.0.1";
const ffmpegCommand = process.env.FFMPEG_BIN ?? "ffmpeg";
const ffmpegPrefixArgs = JSON.parse(process.env.FFMPEG_PREFIX_ARGS ?? "[]");
const secret = "ditch-rtmp-transport-smoke-secret-0001";
const sessionId = "4ca7b46c-82a3-4f97-9d9a-cdc89a765f58";
const streamPath = `/live/${sessionId}`;

assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, "RTMP_SMOKE_PORT must be valid");
assert.ok(Array.isArray(ffmpegPrefixArgs), "FFMPEG_PREFIX_ARGS must be a JSON array");

const ffmpegCheck = spawnSync(ffmpegCommand, [...ffmpegPrefixArgs, "-version"], { encoding: "utf8" });
if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
  throw new Error(`ffmpeg is required for the RTMP transport smoke test: ${ffmpegCheck.stderr ?? ""}`);
}

const signedUrl = () => {
  const expires = Math.floor(Date.now() / 1000) + 60;
  const digest = createHash("md5")
    .update(`${streamPath}-${expires}-${secret}`)
    .digest("hex");
  return `rtmp://${host}:${port}${streamPath}?sign=${expires}-${digest}`;
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegCommand, [...ffmpegPrefixArgs, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, output }));
  });

const waitFor = async (predicate, label, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
};

Context.config = {
  bind: "0.0.0.0",
  rtmp: { port },
  auth: { play: true, publish: true, secret },
};
Context.sessions.clear();
Context.broadcasts.clear();
Context.eventEmitter.removeAllListeners();
const rtmpServer = new NodeRtmpServer();

let publishedPath;
let completedPath;
Context.eventEmitter.on("postPublish", (session) => { publishedPath = session.streamPath; });
Context.eventEmitter.on("donePublish", (session) => { completedPath = session.streamPath; });

const publisherArgs = [
  "-hide_banner", "-loglevel", "error", "-re",
  "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15",
  "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000",
  "-t", "4", "-c:v", "libx264", "-preset", "ultrafast",
  "-tune", "zerolatency", "-g", "30", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "96k", "-f", "flv", signedUrl(),
];

try {
  rtmpServer.run();
  await new Promise((resolve) => setTimeout(resolve, 300));

  const publisherResult = runFfmpeg(publisherArgs);
  await waitFor(() => publishedPath === streamPath, "authenticated RTMP publish");

  const subscriber = await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-rw_timeout", "5000000",
    "-i", signedUrl(), "-t", "1", "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-",
  ]);
  assert.equal(subscriber.code, 0, `RTMP playback failed:\n${subscriber.output}`);

  const publisher = await publisherResult;
  assert.equal(publisher.code, 0, `RTMP publisher failed:\n${publisher.output}`);
  await waitFor(() => completedPath === streamPath, "RTMP publisher completion");

  console.log("RTMP transport smoke passed (authenticated H.264/AAC publish, play, and disconnect).");
  process.exitCode = 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  setTimeout(() => process.exit(process.exitCode ?? 1), 25);
}
