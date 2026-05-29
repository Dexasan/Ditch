import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ditchlive.app"),
  title: {
    default: "DITCH — One stream. Every platform. Anyone can join.",
    template: "%s | DITCH",
  },
  description:
    "DITCH lets you stream to Twitch, YouTube, TikTok, Kick and more simultaneously — and pull viewers from any platform onto your live stream in real time.",
  keywords: [
    "multi-stream",
    "live streaming",
    "stream to multiple platforms",
    "interactive live stream",
    "go live",
    "viewer on stream",
    "ditch live",
  ],
  openGraph: {
    type: "website",
    url: "https://ditchlive.app",
    siteName: "DITCH",
    title: "DITCH — One stream. Every platform. Anyone can join.",
    description:
      "Stream to Twitch, YouTube, TikTok, Kick and more at the same time. Pull viewers from any platform onto your live stream.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DITCH — One stream. Every platform. Anyone can join.",
    description:
      "Stream to Twitch, YouTube, TikTok, Kick and more at the same time. Pull viewers from any platform onto your live stream.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://ditchlive.app",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
