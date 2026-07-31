import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compositor = readFileSync(path.join(webRoot, "src/hooks/useCompositor.ts"), "utf8");
const studio = readFileSync(path.join(webRoot, "src/app/c/[slug]/studio/Studio.tsx"), "utf8");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(
  compositor.includes('if (e.data?.type === "ready")') &&
    compositor.includes('self.postMessage({ type: "tick", frameIndex, skipped })') &&
    !compositor.includes('setInterval(() => self.postMessage("tick")'),
  "the Worker must keep at most one compositor tick outstanding",
);
check(
  compositor.includes("nextDeadline += interval") &&
    compositor.includes("Math.max(0, nextDeadline - now)"),
  "the scheduler must use a monotonic deadline instead of adding draw time to each frame",
);

const workerSource = compositor.match(/const WORKER_SRC = `([\s\S]*?)`;/)?.[1];
check(
  Boolean(workerSource),
  "the compositor Worker source must remain available to the scheduler regression harness",
);

if (workerSource) {
  let nowMs = 0;
  let scheduledTimer;
  const emitted = [];
  const workerSelf = {
    onmessage: null,
    postMessage(message) {
      emitted.push(message);
    },
  };

  runInNewContext(workerSource, {
    self: workerSelf,
    performance: { now: () => nowMs },
    setTimeout(callback, delay) {
      scheduledTimer = { callback, due: nowMs + delay };
      return scheduledTimer;
    },
    clearTimeout(handle) {
      if (scheduledTimer === handle) scheduledTimer = undefined;
    },
  });

  workerSelf.onmessage?.({ data: { type: "start", interval: 1000 / 60 } });
  const delayedTimer = scheduledTimer;
  nowMs = 101;
  delayedTimer?.callback();

  const lateTick = emitted[0];
  check(
    lateTick?.frameIndex === 6 && lateTick?.skipped === 6,
    "a delayed Worker timer must skip stale frame deadlines when it wakes",
  );

  workerSelf.onmessage?.({ data: { type: "ready" } });
  check(
    Boolean(scheduledTimer && scheduledTimer.due - nowMs > 10),
    "a late wake-up must resume at the next deadline without a catch-up burst",
  );
}
check(
  compositor.includes("frameWritePending") &&
    compositor.includes("(writer.desiredSize ?? 1) <= 0") &&
    /fpsRef\.current\.dropped\+\+;\s+reportFps\(\);\s+return;/.test(compositor),
  "MediaStreamTrackGenerator writes must honor backpressure and keep reporting FPS",
);
check(
  compositor.includes("duration: frameDurationUs") &&
    compositor.includes("frameClockStartUs + frameIndex * frameDurationUs"),
  "generated frames must carry target-rate timestamps and durations",
);
for (const metric of ["drawn", "delivered", "dropped"]) {
  check(
    compositor.includes(`${metric}: 0`) && compositor.includes(`fps.${metric}`),
    `compositor diagnostics must retain the ${metric} metric`,
  );
}
check(
  compositor.includes("alpha: false") &&
    compositor.includes("desynchronized: true") &&
    compositor.includes('ctx.imageSmoothingQuality = "high"'),
  "the 1080p canvas must retain its opaque low-latency, high-quality context",
);

check(
  studio.includes('settings.outputResolution === "1080p"') &&
    studio.includes('settings.contentMode === "detail"') &&
    studio.includes("targetFps === 30") &&
    studio.includes('label: "program-detail 1080p30 @5Mbps"'),
  "native DITCH playback must retain 1080p for a 1080p Detail/30 program",
);
check(
  studio.includes('label: `720p30 @3Mbps (${settings.contentMode})`'),
  "Motion/60 broadcasts must retain the lighter native viewer profile",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Compositor pacing and quality invariants verified.");
}
