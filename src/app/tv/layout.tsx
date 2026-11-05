import type { Metadata, Viewport } from "next";
import "./tv.css";
import { TvProvider } from "@/lib/tv/store";
import { Shell } from "@/components/tv/Shell";

export const metadata: Metadata = {
  title: "SlamAI TV — Live channels on every screen",
  description:
    "A player for free-to-air TV from around the world, plus any playlist or provider login you already pay for. Works in the browser and installs on your phone.",
  manifest: "/tv-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SlamAI TV",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/tv-icon.svg", apple: "/tv-icon.svg" },
  /* Channel logos come from hundreds of broadcaster hosts; sending a referrer
     to all of them is needless leakage. */
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <TvProvider>
      <Shell>{children}</Shell>
    </TvProvider>
  );
}
