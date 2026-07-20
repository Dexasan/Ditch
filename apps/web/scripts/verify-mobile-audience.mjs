import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(webRoot, relativePath), "utf8");

const channelView = read("src/app/c/[slug]/ChannelView.tsx");
const channelPage = read("src/app/c/[slug]/page.tsx");
const agoraHook = read("src/hooks/useAgoraRoom.ts");
const agoraLib = read("src/lib/agora.ts");
const css = read("src/app/globals.css");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(
  (channelView.match(/<ChatPanel\b/g) ?? []).length === 1,
  "ChannelView must instantiate ChatPanel exactly once",
);
check(
  !channelView.includes("calc(100dvh - 57px)"),
  "the live viewer must not restore the hardcoded 57px header offset",
);
check(
  channelView.includes("(min-width: 768px) and (hover: hover) and (pointer: fine)"),
  "desktop layout must require a fine pointer as well as viewport width",
);
check(
  channelView.includes('overflowWrap: "anywhere"'),
  "chat messages must wrap long unbroken content",
);
check(
  channelPage.includes('height: isActiveLiveSession ? "100dvh" : undefined'),
  "the active live page must provide a bounded dynamic-viewport shell",
);
check(
  /slotToUid\s*=\s*\(slotIndex:\s*number\)\s*=>\s*slotIndex\s*\+\s*1/.test(agoraLib),
  "participant Agora UID must remain slot_index + 1",
);
check(
  channelView.includes("const wantUid = slotToUid(myParticipant.slot_index)") &&
    channelView.includes("goLiveAsHost(wantUid)") &&
    channelView.includes(
      "const uid = myParticipant?.slot_index != null ? slotToUid(myParticipant.slot_index) : 0",
    ),
  "a live guest must rejoin under the compositor UID when their slot arrives",
);

const goLiveStart = agoraHook.indexOf("const goLiveAsHost");
const goLiveEnd = agoraHook.indexOf("const demoteToAudience", goLiveStart);
const goLiveBlock = agoraHook.slice(goLiveStart, goLiveEnd);
const captureIndex = goLiveBlock.indexOf("createMicrophoneAndCameraTracks()");
const leaveIndex = goLiveBlock.indexOf("await clientRef.current.leave");
const publishIndex = goLiveBlock.indexOf("await client.publish");
check(
  captureIndex >= 0 && leaveIndex > captureIndex && publishIndex > leaveIndex,
  "guest camera capture must stay before the first leave/join await and before publish",
);
check(
  goLiveBlock.includes('user.uid === CREATOR_COMPOSITE_UID && mediaType === "audio"'),
  "on-stage guests must continue to reject program-mix audio",
);
check(
  css.includes("env(safe-area-inset-bottom)"),
  "safe-area padding must remain in the mobile audience CSS",
);
check(
  channelView.includes("window.visualViewport") &&
    css.includes("@media (orientation: landscape) and (pointer: coarse) and (max-height: 600px)"),
  "keyboard avoidance and the landscape-phone player mode must remain enabled",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Mobile audience invariants verified.");
}
