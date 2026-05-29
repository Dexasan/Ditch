import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DITCH — Go live once. Stream everywhere.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A14",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(255,29,180,0.18) 0%, transparent 65%)",
          }}
        />

        {/* DITCH wordmark */}
        <div
          style={{
            fontSize: 128,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-6px",
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          DITCH
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "rgba(255,255,255,0.55)",
            marginTop: 20,
            zIndex: 1,
            gap: 10,
          }}
        >
          <span>Go live once.</span>
          <span style={{ color: "#FF1DB4" }}>Stream everywhere.</span>
        </div>

        {/* Platform pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 52,
            zIndex: 1,
          }}
        >
          {["Twitch", "YouTube", "TikTok", "Kick"].map((platform) => (
            <div
              key={platform}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
                fontSize: 20,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {platform}
            </div>
          ))}
          <div
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(255,29,180,0.35)",
              color: "#FF1DB4",
              fontSize: 20,
              background: "rgba(255,29,180,0.07)",
            }}
          >
            + more
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            color: "rgba(255,255,255,0.25)",
            fontSize: 22,
            letterSpacing: "3px",
            zIndex: 1,
          }}
        >
          ditchlive.app
        </div>
      </div>
    ),
    { ...size },
  );
}
