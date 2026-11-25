import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "See SlamAI Voice handle a real emergency call, then tell us about your business and we'll walk you through it on your own numbers.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
