import type { Metadata } from "next";
import { LoginForm } from "@/components/remit/LoginForm";
import { settings } from "@/remit/config/settings";

export const metadata: Metadata = { title: "Sign in" };

export default function SendLoginPage() {
  return (
    <LoginForm
      demoMode={settings.demoMode}
      demoEmail={process.env.REMIT_DEMO_EMAIL || "demo@example.com"}
    />
  );
}
