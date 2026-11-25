import { db } from "@/lib/db";
import { badRequest, jsonOk, notFound, parseBody, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { approveCompliance, rejectCompliance } from "@/remit/server/transfer-service";
import { complianceDecisionSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/admin/reviews/:id — approve or reject a flagged transfer.
 * Requires the compliance:review permission; the decision and the reviewer are
 * written to the audit log.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdmin(PERMISSIONS.REVIEW_COMPLIANCE);
  const { id } = await context.params;
  const input = await parseBody(request, complianceDecisionSchema);

  const review = await db.remitRiskReview.findUnique({ where: { id } });
  if (!review) throw notFound("Review not found");

  if (input.decision === "APPROVE") {
    const transfer = await approveCompliance(review.transferId, user.id, input.notes);
    return jsonOk({ status: transfer.status, complianceStatus: transfer.complianceStatus });
  }

  if (!input.notes) throw badRequest("A rejection needs a reason for the record");
  const transfer = await rejectCompliance(review.transferId, user.id, input.notes);
  return jsonOk({ status: transfer.status, complianceStatus: transfer.complianceStatus });
});
