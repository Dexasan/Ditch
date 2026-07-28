export function validateEnv() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[relay] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (process.env.RTMP_INGEST_ENABLED === "true") {
    const secret = process.env.INGEST_AUTH_SECRET?.trim();
    if (!secret || secret.length < 32) {
      console.error(
        "[relay] INGEST_AUTH_SECRET must be at least 32 characters when RTMP ingest is enabled",
      );
      process.exit(1);
    }
  }
}