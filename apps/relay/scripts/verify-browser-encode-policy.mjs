import assert from "node:assert/strict";
import { buildArgs } from "../src/lib/ffmpeg.ts";

const params = { videoBitrateKbps: 8000, audioBitrateKbps: 192, preset: "balanced", fps: 60 };
const target = "rtmps://example.youtube.test/live/secret";
const requiresRelayGop = () => true;
const option = (args, flag) => {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `missing ${flag}`);
  return args[index + 1];
};
const previousOverride = process.env.RELAY_REENCODE_WEB_CODECS;

try {
  delete process.env.RELAY_REENCODE_WEB_CODECS;
  const mp4 = buildArgs([target], { ...params, container: "mp4" }, undefined, requiresRelayGop);
  assert.equal(option(mp4, "-c:v"), "copy", "WebCodecs H264 must remain first-generation");
  assert.equal(option(mp4, "-tag:v"), "7", "tee-compatible FLV H264 tag must be normalized");
  assert.ok(!mp4.includes("libx264"), "WebCodecs RTMP must not also create an x264 output");

  const hlsPath = "/tmp/ditch-quality/index.m3u8";
  const mp4Hls = buildArgs([], { ...params, container: "mp4" }, hlsPath, requiresRelayGop);
  assert.equal(option(mp4Hls, "-c:v"), "copy", "WebCodecs HLS must preserve browser H264");
  assert.ok(mp4Hls.some((arg) => arg.includes(hlsPath)), "HLS copy branch must include the playlist");
  assert.ok(!mp4Hls.includes("libx264"), "WebCodecs HLS must not create an x264 generation");

  const webm = buildArgs([target], { ...params, container: "webm" }, undefined, requiresRelayGop);
  assert.equal(option(webm, "-c:v"), "libx264", "MediaRecorder must retain relay-enforced GOP");
  assert.equal(option(webm, "-g"), "120", "60fps fallback must keep a two-second GOP");
  assert.equal(option(webm, "-pix_fmt"), "yuv420p", "fallback must remain RTMP-compatible 4:2:0");

  process.env.RELAY_REENCODE_WEB_CODECS = "true";
  const rollback = buildArgs([target], { ...params, container: "mp4" }, undefined, requiresRelayGop);
  assert.equal(option(rollback, "-c:v"), "libx264", "override must restore relay re-encoding");
} finally {
  if (previousOverride === undefined) delete process.env.RELAY_REENCODE_WEB_CODECS;
  else process.env.RELAY_REENCODE_WEB_CODECS = previousOverride;
}

console.log("Browser relay encode policy verified.");
