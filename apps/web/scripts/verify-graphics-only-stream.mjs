import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");
const readWeb = (relativePath) => readFileSync(path.join(webRoot, relativePath), "utf8");
const readRepo = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");

const studio = readWeb("src/app/c/[slug]/studio/Studio.tsx");
const compositor = readWeb("src/hooks/useCompositor.ts");
const agora = readWeb("src/hooks/useAgoraRoom.ts");
const ffmpeg = readRepo("apps/relay/src/lib/ffmpeg.ts");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const type of ["text", "shape", "image", "markdown", "widget"]) {
  check(
    compositor.includes(`case "${type}"`),
    `the compositor must continue rendering ${type} layers without a camera`,
  );
}

check(
  compositor.includes("setStream(new MediaStream([videoTrack, ...audioDest.stream.getAudioTracks()]))"),
  "the compositor must create its program stream independently of camera tracks",
);
check(
  studio.includes("const programVideoReady = compositeStream?.getVideoTracks().some(") &&
    studio.includes('enabled: streamStatus !== "offline" && programVideoReady'),
  "relay eligibility must depend on the compositor video track, not a camera layer",
);
check(
  studio.includes("publishAudio: true"),
  "the studio must publish microphone audio for camera-free scenes",
);
check(
  agora.includes("publishAudio?: boolean") &&
    agora.includes("createMicrophoneAudioTrack()") &&
    agora.includes("createCameraVideoTrack()"),
  "Agora must support microphone publication independently from the camera",
);
check(
  ffmpeg.includes('const mapFlags = ["-map", "0:v", "-map", "0:a?"]'),
  "the relay must tolerate a graphics-only stream without a usable audio input",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Graphics-only stream invariants verified.");
}