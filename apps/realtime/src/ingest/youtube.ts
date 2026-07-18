import type { EmitFn, Ingestor } from "./types.js";

// Reads a YouTube live broadcast's chat via the Data API v3 (polling). Requires
// a server-side API key in GOOGLE_API_KEY. channelRef is either a channel id
// (UC...) or an @handle. Discovery flow:
//   ref → channelId → active live videoId → activeLiveChatId → poll messages
//
// Quota note: search.list (live-video discovery) costs 100 units/call, so we
// only do it once per session start. Polling liveChatMessages is cheap.
const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.GOOGLE_API_KEY;
const MIN_POLL_MS = 3000;
const ERROR_BACKOFF_MS = 15000;
// Discovery primarily scrapes the channel's public /live page (zero quota,
// no indexing lag), so retries can be frequent. search.list is only a
// fallback every 4th attempt because it costs 100 quota units AND its index
// lags minutes behind a stream going live.
const DISCOVERY_RETRY_MS = 30000;
const MAX_DISCOVERY_ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: URL): Promise<any | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function resolveChannelId(ref: string): Promise<string | null> {
  const trimmed = ref.trim();
  if (/^UC[\w-]{20,}$/.test(trimmed)) return trimmed;

  const handle = trimmed.replace(/^@/, "");
  const url = new URL(`${API}/channels`);
  url.searchParams.set("part", "id");
  url.searchParams.set("forHandle", `@${handle}`);
  url.searchParams.set("key", KEY!);
  const data = await getJson(url);
  return data?.items?.[0]?.id ?? null;
}

async function findLiveVideoId(channelId: string): Promise<string | null> {
  const url = new URL(`${API}/search`);
  url.searchParams.set("part", "id");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("eventType", "live");
  url.searchParams.set("type", "video");
  url.searchParams.set("key", KEY!);
  const data = await getJson(url);
  return data?.items?.[0]?.id?.videoId ?? null;
}

// Zero-quota, zero-lag discovery: the channel's public /live page embeds the
// current broadcast's videoId the moment it starts, while the Data API's
// search index lags minutes behind. Works with both UC... ids and @handles.
async function scrapeLiveVideoId(ref: string): Promise<string | null> {
  const trimmed = ref.trim();
  const path = /^UC[\w-]{20,}$/.test(trimmed)
    ? `channel/${trimmed}`
    : `@${trimmed.replace(/^@/, "")}`;
  try {
    const res = await fetch(`https://www.youtube.com/${path}/live`, {
      headers: {
        "accept-language": "en",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // When the channel is not live, /live serves the channel home page, which
    // still contains videoIds of past uploads - only trust a live document.
    if (!/"isLive"\s*:\s*true/.test(html)) return null;
    const m = html.match(/"videoId"\s*:\s*"([\w-]{11})"/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function getLiveChatId(videoId: string): Promise<string | null> {
  const url = new URL(`${API}/videos`);
  url.searchParams.set("part", "liveStreamingDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", KEY!);
  const data = await getJson(url);
  return data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
}

export function startYouTube(channelRef: string, emit: EmitFn): Ingestor {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (!KEY) {
    console.warn("[ingest] youtube skipped: GOOGLE_API_KEY not set");
    return { stop: () => {} };
  }

  (async () => {
    try {
      // Only needed for the search.list fallback - the /live scrape resolves
      // handles by itself, so a failed resolution is not fatal.
      const channelId = await resolveChannelId(channelRef);
      if (!channelId) {
        console.warn(`[ingest] youtube: could not resolve channel "${channelRef}" via API (scrape-only mode)`);
      }
      // Retry discovery: the broadcast may start shortly after DITCH goes live.
      let liveChatId: string | null = null;
      for (let attempt = 1; active && attempt <= MAX_DISCOVERY_ATTEMPTS; attempt++) {
        let videoId = await scrapeLiveVideoId(channelRef);
        if (!videoId && channelId && (attempt - 1) % 4 === 0) {
          videoId = await findLiveVideoId(channelId);
        }
        if (videoId) liveChatId = await getLiveChatId(videoId);
        if (liveChatId) break;
        console.warn(
          `[ingest] youtube: no live broadcast for "${channelRef}" (attempt ${attempt}/${MAX_DISCOVERY_ATTEMPTS})`,
        );
        if (attempt < MAX_DISCOVERY_ATTEMPTS) await sleep(DISCOVERY_RETRY_MS);
      }
      if (!active || !liveChatId) return;

      console.log(`[ingest] youtube connector started for ${channelRef}`);
      let pageToken: string | undefined;
      let firstPage = true;

      const poll = async () => {
        if (!active) return;
        try {
          const url = new URL(`${API}/liveChat/messages`);
          url.searchParams.set("liveChatId", liveChatId);
          url.searchParams.set("part", "snippet,authorDetails");
          url.searchParams.set("key", KEY!);
          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const data = await getJson(url);
          if (!active) return;
          if (!data) {
            timer = setTimeout(poll, ERROR_BACKOFF_MS);
            return;
          }

          pageToken = data.nextPageToken;
          // Skip the first page: it's chat backlog from before we connected and
          // would flood the room with stale messages.
          if (!firstPage) {
            for (const item of data.items ?? []) {
              const text: string | undefined = item?.snippet?.displayMessage;
              const author: string | undefined = item?.authorDetails?.displayName;
              if (text && author) emit(author, text);
            }
          }
          firstPage = false;

          const wait = Math.max(Number(data.pollingIntervalMillis) || 5000, MIN_POLL_MS);
          timer = setTimeout(poll, wait);
        } catch (err) {
          console.error("[ingest] youtube poll failed:", err);
          if (active) timer = setTimeout(poll, ERROR_BACKOFF_MS);
        }
      };

      poll();
    } catch (err) {
      console.error("[ingest] youtube init failed:", err);
    }
  })();

  return {
    stop: () => {
      active = false;
      if (timer) clearTimeout(timer);
    },
  };
}
