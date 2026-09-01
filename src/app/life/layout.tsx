import type { Metadata, Viewport } from "next";
import "./life.css";
import { LifeProvider } from "@/lib/life/store";
import { Shell } from "@/components/life/Shell";

export const metadata: Metadata = {
  title: "Elite Life OS — Personal Command Center",
  description:
    "A personal operating system built on eight habits. Win tomorrow tonight, protect your morning, build momentum, choose hard.",
  manifest: "/life-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Life OS",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/life-icon.svg", apple: "/life-icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return (
    <LifeProvider>
      <Shell>{children}</Shell>
    </LifeProvider>
  );
}
