if ("window" in globalThis) throw new Error("@ditch/db is server-only");
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\\[rn]/g, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY — check your .env file"
  );
}

// Hard ceiling on every Supabase HTTP call. Without it a network-level stall
// (undici's connect timeout is 10s, and supabase-js retries) turns a single
// request into ~50s of hanging, which cascades: the caller's own timeout fires,
// Vercel kills the server render, and the whole page 500s. Failing fast lets
// callers degrade gracefully instead.
const FETCH_TIMEOUT_MS = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || 8000;

// Derived from fetch itself so this compiles under both the Node-only and
// DOM lib configurations used across the workspace.
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function timeoutFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  // Respect a caller-supplied signal by racing it against ours.
  const signal =
    init?.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, timeout])
      : (init?.signal ?? timeout);
  return fetch(input, { ...init, signal });
}

// Server-only anonymous client (respects Row Level Security)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: timeoutFetch },
});

// Server-only admin client — bypasses RLS. Never expose to the browser.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timeoutFetch },
    })
  : null;

export type { Database };
