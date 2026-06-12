import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "ditch master control: one stream to every platform, anyone can join";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Master Control palette (kept inline: the OG renderer cannot read CSS vars)
const PAPER = "#F2F0EA";
const PANEL = "#FDFCFA";
const SCREEN = "#26261F";
const LINE = "#D3D1C7";
const INK = "#2C2C2A";
const LABEL = "#5F5E5A";
const FAINT = "#888780";
const TALLY = "#FF2D92";
const SMPTE = ["#9A9A8E", "#A8A85E", "#6EA8A8", "#6EA86E", "#A86EA8", "#A86E6E", "#6E6EA8"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: PAPER,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
        }}
      >
        {/* the panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 1040,
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 24,
            padding: 36,
          }}
        >
          {/* header row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", color: LABEL, fontSize: 22, letterSpacing: 3 }}>
              ditch · master control
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: TALLY,
                }}
              />
              <div style={{ display: "flex", color: INK, fontSize: 22, letterSpacing: 3 }}>
                on air
              </div>
            </div>
          </div>

          {/* master screen */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              overflow: "hidden",
              border: `1px solid ${LINE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: SCREEN,
                height: 320,
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: PAPER,
                  fontSize: 76,
                  letterSpacing: 22,
                }}
              >
                one stream
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#B5B3A8",
                  fontSize: 26,
                  letterSpacing: 6,
                  marginTop: 26,
                }}
              >
                every platform · anyone can join
              </div>
            </div>
            {/* smpte strip */}
            <div style={{ display: "flex", height: 8, width: "100%" }}>
              {SMPTE.map((color) => (
                <div key={color} style={{ display: "flex", flex: 1, background: color }} />
              ))}
            </div>
          </div>

          {/* footer row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 28,
            }}
          >
            <div style={{ display: "flex", color: FAINT, fontSize: 20, letterSpacing: 3 }}>
              twitch · youtube · tiktok · kick
            </div>
            <div style={{ display: "flex", color: FAINT, fontSize: 20, letterSpacing: 3 }}>
              ditchlive.app
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
