import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/remit/admin/reviews — transfers waiting on a compliance decision. */
export const GET = route(async () => {
  await requireAdmin(PERMISSIONS.REVIEW_COMPLIANCE);
  const reviews = await db.remitRiskReview.findMany({
    where: { status: "OPEN" },
    include: {
      transfer: {
        include: {
          recipient: true,
          corridor: { select: { isLive: true } },
          customer: { select: { id: true, fullName: true, email: true, kycStatus: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk({
    reviews: reviews.map((review) => ({
      id: review.id,
      reasons: review.reasons,
      riskScore: review.riskScore,
      createdAt: review.createdAt.toISOString(),
      transfer: serializeTransfer(review.transfer),
      customer: review.transfer.customer,
    })),
  });
});
