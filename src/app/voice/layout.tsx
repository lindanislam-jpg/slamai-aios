import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SlamAI Voice — Your AI Receptionist. 24/7. Never Miss a Customer.",
  description:
    "SlamAI Voice answers your calls, talks to customers, captures leads, books appointments and keeps your business running around the clock.",
  openGraph: {
    title: "SlamAI Voice — Your AI Receptionist",
    description:
      "Answers your calls, talks to customers, captures leads and books appointments. 24 hours a day.",
    type: "website",
  },
};

export default function VoiceMarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#08081a] text-slate-100">{children}</div>;
}
