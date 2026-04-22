export function validateEnv() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[relay] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}
