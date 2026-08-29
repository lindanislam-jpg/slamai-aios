import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SlamAI — AI that answers your phone and books the job",
  description:
    "An AI phone agent for Irish service businesses. It answers every call, talks to the customer, books them in, and writes the lead straight into your CRM. Works at 9pm on a Sunday.",
  keywords: "AI phone agent, AI receptionist, missed calls, voice AI, CRM, Ireland, SlamAI",
  openGraph: {
    title: "SlamAI — stop losing jobs to missed calls",
    description:
      "An AI that answers your phone, books the customer in, and files the lead in your CRM.",
    type: "website",
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
