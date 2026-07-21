import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");
const readWeb = (relativePath) => readFileSync(path.join(webRoot, relativePath), "utf8");
const readRepo = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");

const relayHook = readWeb("src/hooks/useRelayStream.ts");
const relayServer = readRepo("apps/relay/src/index.ts");
const ffmpeg = readRepo("apps/relay/src/lib/ffmpeg.ts");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(
  relayHook.includes("if (cancelled || retryTimer) return;") &&
    relayHook.includes("closeSocket(ws, false);") &&
    relayHook.includes("retryTimer = null;"),
  "reconnect scheduling must remain idempotent and close the failed socket",
);
const startedBlock = relayHook.slice(
  relayHook.indexOf('if (msg.type === "started")'),
  relayHook.indexOf('if (msg.type === "error")'),
);
const firstMediaStart = relayHook.indexOf('if (msg.type === "first_media")');
const firstMediaBlock = relayHook.slice(firstMediaStart, firstMediaStart + 1_000);
check(
  !startedBlock.includes("attempts = 0;") && firstMediaBlock.includes("attempts = 0;"),
  "the retry budget must reset after first media, not after ffmpeg merely spawns",
);
check(
  relayHook.includes("msg.retryable === false") &&
    relayServer.includes('retryable: false'),
  "permanent authorization/configuration errors must not consume all reconnect attempts",
);
check(
  relayHook.includes("MAX_SOCKET_BUFFER_BYTES") &&
    relayHook.includes("ws.bufferedAmount >= MAX_SOCKET_BUFFER_BYTES"),
  "the browser must bound its WebSocket send queue",
);
check(
  relayServer.includes("if (!session.write(data as Buffer)) ws.pause();") &&
    relayServer.includes("session.onDrain(") &&
    relayServer.includes("ws.resume();"),
  "the relay must propagate ffmpeg stdin backpressure to the WebSocket",
);
check(
  ffmpeg.includes("write: (chunk: Buffer) => boolean;") &&
    ffmpeg.includes("onDrain: (cb: () => void) => void;"),
  "the ffmpeg session contract must expose write pressure and drain events",
);
for (const metric of [
  "auth_ms",
  "database_ms",
  "hls_setup_ms",
  "ffmpeg_spawn_ms",
  "first_browser_chunk_ms",
  "first_relay_media_ms",
  "peak_socket_buffer_bytes",
]) {
  check(
    relayHook.includes(metric) || relayServer.includes(metric),
    `relay performance diagnostics must retain ${metric}`,
  );
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Relay reliability and performance invariants verified.");
}
