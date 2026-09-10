import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeCorridor, serializeRecipient } from "@/remit/server/serialize";
import { SendMoneyFlow } from "@/components/remit/SendMoneyFlow";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send money" };

export default async function SendNewTransferPage() {
  const customer = await requireCustomer();

  const [corridors, recipients] = await Promise.all([
    db.remitCorridor.findMany({
      where: { isActive: true },
      include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
      orderBy: { createdAt: "asc" },
    }),
    db.remitRecipient.findMany({
      where: { customerId: customer.id, isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Send money" description="Three steps. No hidden charges." />
      <SendMoneyFlow
        corridors={corridors.map(serializeCorridor)}
        recipients={recipients.map(serializeRecipient)}
        kycStatus={customer.kycStatus}
      />
    </div>
  );
}
