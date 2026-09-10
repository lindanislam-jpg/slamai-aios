import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/remit/server/auth";
import { VerifyEmailForm } from "@/components/remit/VerifyEmailForm";
import { Card } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your email" };

export default async function SendVerifyPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/send/login");
  if (customer.emailVerifiedAt) redirect("/send/verify-identity");

  return (
    <Suspense fallback={<Card>Loading…</Card>}>
      <VerifyEmailForm email={customer.email} />
    </Suspense>
  );
}
