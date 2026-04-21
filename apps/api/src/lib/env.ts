const REQUIRED_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function validateEnv() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[api] Missing required environment variables:\n  ${missing.join("\n  ")}`);
    console.error("[api] Copy .env.example to .env and fill in your Supabase credentials.");
    process.exit(1);
  }
}
