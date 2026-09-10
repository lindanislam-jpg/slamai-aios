import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005"),
  title: {
    default: "SlamAI Voice — Your AI Receptionist. 24/7. Never Miss a Customer.",
    template: "%s — SlamAI Voice",
  },
  description:
    "SlamAI Voice answers your calls, talks to customers, captures leads, books appointments and keeps your business running around the clock.",
  keywords:
    "AI receptionist, AI phone agent, missed calls, voice AI, call answering service, appointment booking, lead capture",
  openGraph: {
    title: "SlamAI Voice — Your AI Receptionist",
    description:
      "Answers your calls, talks to customers, captures leads and books appointments. 24 hours a day.",
    type: "website",
    siteName: "SlamAI Voice",
  },
  twitter: {
    card: "summary_large_image",
    title: "SlamAI Voice — Your AI Receptionist",
    description: "Turn every call into an opportunity. Live in under ten minutes.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a2e",
              color: "#f1f5f9",
              border: "1px solid #2a2a4a",
            },
          }}
        />
      </body>
    </html>
  );
}
