import WebSocket from "ws";
import type { EmitFn, Ingestor } from "./types.js";

// Reads a Twitch channel's chat anonymously over IRC-over-WebSocket. No API key
// or OAuth needed: Twitch lets unauthenticated "justinfan" nicks read public
// chat. We request the tags capability so we get proper display names.
const TWITCH_IRC_WS = "wss://irc-ws.chat.twitch.tv:443";
const RECONNECT_MS = 3000;

// Parses one IRC line into a chat message, or null if it isn't a PRIVMSG.
// Line shape (with tags): "@tag=val;... :nick!user@host PRIVMSG #chan :message"
function parsePrivmsg(line: string): { name: string; body: string } | null {
  let rest = line;
  let tags = "";
  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    if (sp === -1) return null;
    tags = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  const m = rest.match(/^:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :([\s\S]*)$/);
  if (!m) return null;

  let name = m[1];
  const body = m[2].replace(/[\r\n]+$/, "");
  // Prefer the cased display-name from tags when present.
  const dn = tags.split(";").find((t) => t.startsWith("display-name="));
  if (dn) {
    const v = dn.slice("display-name=".length);
    if (v) name = v;
  }
  return { name, body };
}

export function startTwitch(channelRef: string, emit: EmitFn): Ingestor {
  const login = channelRef.replace(/^[#@]/, "").trim().toLowerCase();
  let active = true;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (!active) return;
    ws = new WebSocket(TWITCH_IRC_WS);

    ws.on("open", () => {
      ws?.send("CAP REQ :twitch.tv/tags");
      ws?.send("PASS SCHMOOPIIE");
      ws?.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
      ws?.send(`JOIN #${login}`);
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      for (const line of raw.toString().split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) {
          ws?.send("PONG :tmi.twitch.tv");
          continue;
        }
        const parsed = parsePrivmsg(line);
        if (parsed) emit(parsed.name, parsed.body);
      }
    });

    ws.on("close", () => {
      if (active) reconnectTimer = setTimeout(connect, RECONNECT_MS);
    });
    // Swallow errors; the close handler drives reconnection.
    ws.on("error", () => {});
  }

  connect();
  console.log(`[ingest] twitch connector started for #${login}`);

  return {
    stop: () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // already closed
      }
    },
  };
}
