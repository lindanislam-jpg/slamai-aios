import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { Money } from "@/remit/money/money";
import { ReviewQueue } from "@/components/remit/ReviewQueue";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compliance reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin(PERMISSIONS.REVIEW_COMPLIANCE);

  const reviews = await db.remitRiskReview.findMany({
    where: { status: "OPEN" },
    include: { transfer: { include: { customer: true, recipient: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Compliance reviews"
        description="Transfers paused for a human decision. Nothing moves until one of these is cleared."
      />
      <ReviewQueue
        reviews={reviews.map((review) => ({
          id: review.id,
          reasons: review.reasons,
          riskScore: review.riskScore,
          createdAt: review.createdAt.toISOString(),
          reference: review.transfer.reference,
          sourceAmount: Money.fromMinor(
            review.transfer.sourceAmountMinor,
            review.transfer.sourceCurrency,
          ).format(),
          destAmount: Money.fromMinor(
            review.transfer.destAmountMinor,
            review.transfer.destCurrency,
          ).format(),
          recipientName: review.transfer.recipient.fullName,
          customerName: review.transfer.customer.fullName,
          customerEmail: review.transfer.customer.email,
          customerKyc: review.transfer.customer.kycStatus,
        }))}
      />
    </div>
  );
}
