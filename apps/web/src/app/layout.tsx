import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://ditchlive.app"),
  title: {
    default:
      "DITCH | Livestreams your audience can actually join",
    template: "%s | DITCH",
  },
  description:
    "Run your livestream in the browser, multistream anywhere for free, and bring viewers from the chat onto the screen with DITCH.",
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
      "DITCH | Livestreams your audience can actually join",
    description:
      "Run the show in your browser, multistream anywhere for free, and bring viewers from the chat onto the screen.",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "DITCH | Livestreams your audience can actually join",
    description:
      "Run the show in your browser, multistream anywhere for free, and bring viewers from the chat onto the screen.",
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
    <html lang="en" className={`${inter.variable} ${jbMono.variable} ${bebasNeue.variable}`}>
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
