import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Uno", description: "Play Uno with friends in the browser" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
