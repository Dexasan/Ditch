import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ditchlive.app"),
  title: {
    default:
      "DITCH | Multistream to Twitch, YouTube, TikTok and Kick from your browser",
    template: "%s | DITCH",
  },
  description:
    "DITCH is a browser multistream studio. Go live once, broadcast to Twitch, YouTube, TikTok and Kick at the same time, and cue viewers from any platform onto your stream.",
  keywords: [
    "multistream",
    "multistreaming",
    "stream to multiple platforms",
    "browser streaming studio",
    "simulcast",
    "live streaming",
    "go live",
    "viewer on stream",
    "ditch live",
  ],
  openGraph: {
    type: "website",
    url: "https://ditchlive.app",
    siteName: "DITCH",
    title:
      "DITCH | Multistream to Twitch, YouTube, TikTok and Kick from your browser",
    description:
      "One stream, every platform, anyone can join. Go live from your browser and cue viewers from any platform onto your stream.",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "DITCH | Multistream to Twitch, YouTube, TikTok and Kick from your browser",
    description:
      "One stream, every platform, anyone can join. Go live from your browser and cue viewers from any platform onto your stream.",
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
    <html lang="en" className={`${inter.variable} ${jbMono.variable}`}>
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
