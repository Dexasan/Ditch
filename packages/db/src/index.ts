export { supabase, supabaseAdmin } from "./client";
export { verifyAccessToken, localJwtVerificationEnabled } from "./auth";
export type { VerifiedUser } from "./auth";

export type { Database } from "./database.types";
export type { User, Session } from "@supabase/supabase-js";
