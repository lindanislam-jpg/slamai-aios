import { db } from "@/lib/db";
import { jsonOk, notFound, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/remit/transfers/:id/status — lightweight polling endpoint for the
 * tracking screen. Read-only: there is no PUT here, and no route anywhere
 * accepts a status from a client.
 */
export const GET = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const customer = await requireActiveCustomer();
  const { id } = await context.params;

  const transfer = await db.remitTransfer.findUnique({
    where: { id },
    include: {
      recipient: true,
      corridor: { select: { isLive: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!transfer || transfer.customerId !== customer.id) throw notFound("Transfer not found");

  const dto = serializeTransfer(transfer, { includeTimeline: true });
  return jsonOk({
    status: dto.status,
    statusLabel: dto.statusLabel,
    timeline: dto.timeline,
    isDemo: dto.isDemo,
    failureReason: dto.failureReason,
    completedAt: dto.completedAt,
  });
});
