import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeCorridor, serializeRecipient } from "@/remit/server/serialize";
import { RecipientManager } from "@/components/remit/RecipientManager";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recipients" };

export default async function SendRecipientsPage() {
  const customer = await requireCustomer();

  const [recipients, corridors] = await Promise.all([
    db.remitRecipient.findMany({
      where: { customerId: customer.id, isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
    db.remitCorridor.findMany({
      where: { isActive: true },
      include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Recipients"
        description="People you send to. We only store what the payout network needs."
      />
      <RecipientManager
        recipients={recipients.map(serializeRecipient)}
        corridors={corridors.map(serializeCorridor)}
      />
    </div>
  );
}
