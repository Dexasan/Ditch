import { sessionCookieOptions, sessionCookieAttributes, supabaseUrl } from "@/lib/supabase/options";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/home", "/dashboard", "/inbox", "/onboarding"];
const AUTH_ONLY = ["/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, ...sessionCookieAttributes })
          );
        },
      },
    }
  );

  // Verify server-side and persist any rotated session cookies on the response.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const redirect = NextResponse.redirect(new URL("/auth", request.url));
    redirect.headers.set("Cache-Control", "private, no-store");
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  if (isAuthOnly && user) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    redirect.headers.set("Cache-Control", "private, no-store");
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/home/:path*",
    "/dashboard/:path*",
    "/inbox/:path*",
    "/onboarding/:path*",
    "/explore/:path*",
    "/auth",
    "/c/:slug/live/:path*",
    "/c/:slug/studio/:path*",
  ],
};
