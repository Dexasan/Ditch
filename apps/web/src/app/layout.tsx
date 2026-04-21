import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DITCH",
  description: "Go live once. Stream everywhere. Bring everyone back.",
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
