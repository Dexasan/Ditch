import type { User } from "@supabase/supabase-js";

// This UI marker is NEVER a credential. The BFF authenticates from HttpOnly cookies.
const SESSION_MARKER = "cookie-session";
async function authRequest(action: string, body?: unknown) {
  try {
    const response = await fetch(`/api/auth/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Ditch-Request": "1" },
      body: JSON.stringify(body ?? {}), cache: "no-store",
    });
    const result = await response.json();
    return { user: result.user as User | undefined, error: response.ok ? null : { message: result.error as string } };
  } catch { return { user: undefined, error: { message: "Unable to connect. Please try again." } }; }
}

export function createClient() {
  if (typeof window !== "undefined") {
    try {
      for (const key of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(key)) localStorage.removeItem(key);
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.trim().split("=")[0];
        if (/^sb-.*-auth-token/.test(name)) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      }
    } catch { /* Storage may be disabled. Authentication does not depend on it. */ }
  }
  return { auth: {
    async getSession() {
      const { user, error } = await authRequest("session");
      return { data: { session: user ? { user, access_token: SESSION_MARKER } : null }, error };
    },
    async signInWithPassword(input: { email: string; password: string; options?: { captchaToken?: string } }) {
      const { user, error } = await authRequest("signin", { ...input, captchaToken: input.options?.captchaToken });
      return { data: { user: user!, session: user ? { access_token: SESSION_MARKER } : null }, error };
    },
    async signUp(input: { email: string; password: string; options?: { emailRedirectTo?: string; data?: { display_name?: string }; captchaToken?: string } }) {
      return authRequest("signup", { email: input.email, password: input.password, display_name: input.options?.data?.display_name, captchaToken: input.options?.captchaToken });
    },
    async updateUser(input: { data: { display_name: string } }) { return authRequest("profile", input.data); },
    async signOut() { return authRequest("signout"); },
  } };
}
