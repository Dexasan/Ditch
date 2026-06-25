/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ditch/types"],

  async headers() {
    const apiUrl      = process.env.NEXT_PUBLIC_API_URL      ?? "http://localhost:3002";
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001";
    const relayUrl    = process.env.NEXT_PUBLIC_RELAY_URL    ?? "ws://localhost:3003";

    const connectSrc = [
      "'self'",
      // Supabase Auth + DB
      "https://*.supabase.co",
      "wss://*.supabase.co",
      // Agora RTC SDK (camera / mic / screen-share tracks)
      "https://*.agora.io",
      "wss://*.agora.io",
      "https://*.agoraio.cn",
      "wss://*.agoraio.cn",
      // DITCH backend services
      apiUrl,
      realtimeUrl,
      relayUrl,
    ].join(" ");

    // script-src retains 'unsafe-inline'/'unsafe-eval' because Next.js App Router
    // inlines hydration scripts. Tighten to nonce-based CSP once the app is stable.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      `connect-src ${connectSrc}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const headers = [
      { key: "X-Content-Type-Options",  value: "nosniff" },
      { key: "X-Frame-Options",         value: "DENY" },
      { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
      // Allow camera/mic/screen only from the same origin (needed for WebRTC)
      { key: "Permissions-Policy",      value: "camera=(self), microphone=(self), display-capture=(self)" },
      { key: "Content-Security-Policy", value: csp },
    ];

    // HSTS in production only — avoids locking localhost to HTTPS during development
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key:   "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    const deckHeaders = [
      {
        key:   "Content-Type",
        value: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      {
        key:   "Content-Disposition",
        value: 'attachment; filename="DITCH-Deck.pptx"',
      },
    ];

    return [
      { source: "/(.*)", headers },
      { source: "/deck", headers: deckHeaders },
      { source: "/DITCH-Deck.pptx", headers: deckHeaders },
    ];
  },

  // Serve the pitch deck at the clean URL ditchlive.app/deck (keeps the URL,
  // streams the file from /public). The Content-Disposition header above gives
  // it a proper download filename.
  async rewrites() {
    return [{ source: "/deck", destination: "/DITCH-Deck.pptx" }];
  },
};

export default nextConfig;
