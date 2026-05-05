export function validateEnv() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[realtime] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}
