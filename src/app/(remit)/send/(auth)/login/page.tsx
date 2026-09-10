import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/remit/LoginForm";
import { settings } from "@/remit/config/settings";
import { runPreflight } from "@/remit/server/preflight-service";
import { blockingProblems } from "@/remit/config/preflight";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function SendLoginPage() {
  // Sign-in fails before a password is ever checked when the deployment is
  // misconfigured. Send the operator somewhere that says which piece is
  // missing, rather than showing a form that cannot work.
  const report = await runPreflight();
  if (blockingProblems(report.checks).length > 0) redirect("/send/setup");

  return (
    <LoginForm
      demoMode={settings.demoMode}
      demoEmail={process.env.REMIT_DEMO_EMAIL || "demo@example.com"}
    />
  );
}
