// A running chat reader for one external destination. `stop()` must be
// idempotent and tear down sockets/timers so the session leaves no orphans.
export interface Ingestor {
  stop: () => void;
}

// Called by a connector for every chat message it reads. The manager wires this
// to persistence + Socket.io broadcast.
export type EmitFn = (author: string, body: string) => void;
