import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ASGARD Quality Command Centre", template: "%s · ASGARD QC" },
  description: "ASGARD Modular Manufacturing — Quality Department",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b1118", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
