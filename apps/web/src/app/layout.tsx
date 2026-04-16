import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
