import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY — check your .env file"
  );
}

// Browser-safe client (respects Row Level Security)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Server-only admin client — bypasses RLS. Never expose to the browser.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : null;

export type { Database };
export type { User, Session } from "@supabase/supabase-js";
