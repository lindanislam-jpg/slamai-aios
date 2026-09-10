import type { Metadata } from "next";
import { requireCustomer } from "@/remit/server/auth";
import { ProfileForm } from "@/components/remit/ProfileForm";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function SendProfilePage() {
  const customer = await requireCustomer();

  return (
    <div>
      <PageHeader title="Profile" description="Your details and verification status." />
      <ProfileForm
        profile={{
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone ?? "",
          addressLine1: customer.addressLine1 ?? "",
          addressLine2: customer.addressLine2 ?? "",
          city: customer.city ?? "",
          postalCode: customer.postalCode ?? "",
          dateOfBirth: customer.dateOfBirth?.toISOString().slice(0, 10) ?? "",
          countryCode: customer.countryCode,
          status: customer.status,
          kycStatus: customer.kycStatus,
          emailVerified: Boolean(customer.emailVerifiedAt),
          phoneVerified: Boolean(customer.phoneVerifiedAt),
          isDemo: customer.isDemo,
        }}
      />
    </div>
  );
}
