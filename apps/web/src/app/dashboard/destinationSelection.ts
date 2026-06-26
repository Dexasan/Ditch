// Per-broadcast destination selection, shared between the dashboard's
// DestinationList (the checkboxes) and SessionPanel (the Go live button).
//
// We persist the *disabled* destination ids (an opt-out set) rather than the
// enabled ones, so a newly added destination defaults to ON without any write.
// Scoped to localStorage keyed by channel; it's just UI state, not a source of
// truth; the relay still reads stream_destinations applied at go-live.

export function disabledKey(channelId: string): string {
  return `ditch:dest-disabled:${channelId}`;
}

export function readDisabled(channelId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(disabledKey(channelId));
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? new Set(ids as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function writeDisabled(channelId: string, disabled: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(disabledKey(channelId), JSON.stringify([...disabled]));
  } catch {
    // localStorage unavailable (private mode / quota) - selection just won't persist.
  }
}
