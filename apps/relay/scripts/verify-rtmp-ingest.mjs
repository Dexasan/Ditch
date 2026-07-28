import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

const sources = {
  api: read("apps/api/src/routes/ingest.ts"),
  relay: read("apps/relay/src/lib/ingest.ts"),
  relayIndex: read("apps/relay/src/index.ts"),
  ffmpeg: read("apps/relay/src/lib/ffmpeg.ts"),
  console: read("apps/web/src/app/dashboard/SessionConsole.tsx"),
  migration: read("supabase/migrations/009_session_source.sql"),
};

const requiredSourceContracts = [
  ["API feature gate", sources.api, 'RTMP_INGEST_ENABLED !== "true"'],
  ["API session ownership guard", sources.api, "assertSessionOwner(request.user.id"],
  ["API destination requirement", sources.api, "Select at least one destination"],
  ["API idle-session requirement", sources.api, 'session.status !== "idle"'],
  ["API marks RTMP source", sources.api, '.update({ source_type: "rtmp" })'],
  ["relay publish auth", sources.relay, "publish: true"],
  ["relay play auth", sources.relay, "play: true"],
  ["relay validates RTMP source", sources.relay, 'session.source_type !== "rtmp"'],
  ["relay validates session state", sources.relay, '!["idle", "live"].includes(session.status)'],
  ["relay enforces shared capacity", sources.relay, "options.activeSessions.size >= options.maxActiveStreams"],
  ["relay signs its local pull", sources.relay, "signStreamPath(path, expires, secret)"],
  ["relay handles publisher disconnect", sources.relay, 'nms.on("donePublish"'],
  ["relay watches for remote session end", sources.relay, "STATUS_POLL_MS"],
  ["browser relay rejects RTMP sessions", sources.relayIndex, 'row.source_type === "rtmp"'],
  ["health reports ingest status", sources.relayIndex, "rtmp_ingest_enabled"],
  ["health reports active ingests", sources.relayIndex, "active_ingests"],
  ["ingest remuxes video", sources.ffmpeg, '"-c:v", "copy"'],
  ["ingest remuxes audio", sources.ffmpeg, '"-c:a", "copy"'],
  ["dashboard requests credentials", sources.console, "ingest-credentials"],
  ["dashboard polls session state", sources.console, '`/sessions/${session.id}`'],
  ["migration defaults browser source", sources.migration, "default 'browser'"],
];

for (const [name, source, expected] of requiredSourceContracts) {
  assert.ok(source.includes(expected), `${name}: missing ${JSON.stringify(expected)}`);
}

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
const BroadcastServer = require(resolve(dirname(packageEntry), "server/broadcast_server.js"));
const verifier = new BroadcastServer();
const secret = "ditch-ingest-verification-secret-0001";
const streamPath = "/live/f5e351a4-753b-4248-85d2-4c8f2f8897bf";
const expires = Math.floor(Date.now() / 1000) + 60;
const digest = createHash("md5")
  .update(`${streamPath}-${expires}-${secret}`)
  .digest("hex");
const session = { streamPath, streamQuery: { sign: `${expires}-${digest}` } };

assert.equal(verifier.verifyAuth(secret, session), true, "valid signature rejected");
const tamperedDigest = digest.replace(/^./, digest[0] === "0" ? "1" : "0");
assert.equal(
  verifier.verifyAuth(secret, { streamPath, streamQuery: { sign: `${expires}-${tamperedDigest}` } }),
  false,
  "tampered signature accepted",
);

const expiredAt = Math.floor(Date.now() / 1000) - 1;
const expiredDigest = createHash("md5")
  .update(`${streamPath}-${expiredAt}-${secret}`)
  .digest("hex");
assert.equal(
  verifier.verifyAuth(secret, { streamPath, streamQuery: { sign: `${expiredAt}-${expiredDigest}` } }),
  false,
  "expired signature accepted",
);

console.log(`RTMP ingest verification passed (${requiredSourceContracts.length} source contracts + auth cases).`);
