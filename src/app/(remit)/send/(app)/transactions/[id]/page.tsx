import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeTransfer, formatDeliveryEstimate } from "@/remit/server/serialize";
import { settings } from "@/remit/config/settings";
import { isCancellable, type TransferStatus } from "@/remit/transfers/status";
import { TransferTracker } from "@/components/remit/TransferTracker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfer" };

export default async function SendTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await requireCustomer();
  const { id } = await params;

  const transfer = await db.remitTransfer.findUnique({
    where: { id },
    include: {
      recipient: true,
      corridor: true,
      quote: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  // Scoped to this customer: another customer's id is a 404, not a 403.
  if (!transfer || transfer.customerId !== customer.id) notFound();

  const dto = serializeTransfer(transfer, { includeTimeline: true });

  return (
    <div>
      <Link
        href="/send/transactions"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-send-body hover:text-send-primary"
      >
        ← All transactions
      </Link>

      <TransferTracker
        transferId={transfer.id}
        canCancel={isCancellable(transfer.status as TransferStatus)}
        demoMode={settings.demoMode}
        initial={{
          status: dto.status,
          statusLabel: dto.statusLabel,
          timeline: (dto.timeline ?? []) as never,
          isDemo: dto.isDemo,
          failureReason: dto.failureReason,
          completedAt: dto.completedAt,
        }}
        summary={{
          reference: dto.reference,
          recipientName: transfer.recipient.fullName,
          sourceAmount: dto.sourceAmount.formatted,
          fee: dto.fee.formatted,
          totalPayable: dto.totalPayable.formatted,
          destAmount: dto.destAmount.formatted,
          rateDisplay: dto.rateDisplay,
          estimatedDelivery: formatDeliveryEstimate(
            transfer.quote.estimatedMinMins,
            transfer.quote.estimatedMaxMins,
          ),
          isSandbox: dto.isSandbox,
        }}
      />
    </div>
  );
}
