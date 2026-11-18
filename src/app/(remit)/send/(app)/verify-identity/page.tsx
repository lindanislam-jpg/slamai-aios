import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/remit/server/auth";
import { settings } from "@/remit/config/settings";
import { IdentityVerification } from "@/components/remit/IdentityVerification";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your identity" };

export default async function SendVerifyIdentityPage() {
  const customer = await requireCustomer();
  if (!customer.emailVerifiedAt) redirect("/send/verify");

  return (
    <div className="mx-auto max-w-[520px]">
      <IdentityVerification
        kycStatus={customer.kycStatus}
        isSandbox={settings.providers.kyc === "sandbox"}
      />
    </div>
  );
}
