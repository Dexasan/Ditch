export const sessionCookieAttributes = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export const sessionCookieOptions = { name: "ditch-auth", ...sessionCookieAttributes };
export function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\\[rn]/g, "");
  if (!value) throw new Error("Supabase URL is missing");
  return new URL(value).origin;
}
