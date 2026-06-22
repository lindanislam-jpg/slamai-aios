import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SlamAI AIOS – The Operating System for Modern Business",
  description:
    "One Platform. Infinite Intelligence. Deploy AI agents, automate workflows, manage leads, create content, and grow your business with SlamAI AIOS.",
  keywords: "AI agents, business automation, CRM, AI operating system, SlamAI",
  openGraph: {
    title: "SlamAI AIOS™",
    description: "The AI Operating System for Modern Business",
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
