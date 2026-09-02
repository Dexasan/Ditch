import type { Metadata } from "next";
import {
  Bebas_Neue,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
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

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ditchlive.app"),
  title: {
    default: "DITCH | Go live everywhere. Let viewers in.",
    template: "%s | DITCH",
  },
  description:
    "A browser-based livestream studio and live channel. Multistream to Twitch, YouTube, TikTok, and Kick, then bring viewers onto the show.",
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
    title: "DITCH - Bring your livestream audience onstage",
    description:
      "Multistream to Twitch, YouTube, TikTok and Kick, then let viewers request a spot and join the show live.",
    images: [
      {
        url: "https://ditchlive.app/og-v3.png",
        width: 1536,
        height: 1024,
        alt: "DITCH. Go live everywhere. Let people in.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DITCH - Bring your livestream audience onstage",
    description:
      "Multistream to Twitch, YouTube, TikTok and Kick, then let viewers request a spot and join the show live.",
    images: ["https://ditchlive.app/og-v3.png"],
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
    <html
      lang="en"
      className={`${inter.variable} ${jbMono.variable} ${bebasNeue.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
