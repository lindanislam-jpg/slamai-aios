import type { Metadata } from "next";

export const metadata: Metadata = {
  // Absolute, so the root layout's "— SlamAI Voice" template is not appended.
  title: { absolute: "SlamAI AIOS — the wider AI operating system" },
  description:
    "The original SlamAI business suite: CRM, AI agents, documents, campaigns and automation. SlamAI Voice is the AI receptionist product.",
};

export default function AiosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
