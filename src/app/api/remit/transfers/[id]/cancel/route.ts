import { db } from "@/lib/db";
import { jsonOk, notFound, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { cancelTransfer } from "@/remit/server/transfer-service";
import { serializeTransfer } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/transfers/:id/cancel
 * Only possible before the funds have been collected — the state machine
 * enforces that, not this route.
 */
export const POST = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const customer = await requireActiveCustomer();
  const { id } = await context.params;

  const existing = await db.remitTransfer.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customer.id) throw notFound("Transfer not found");

  await cancelTransfer(id, customer);

  const transfer = await db.remitTransfer.findUniqueOrThrow({
    where: { id },
    include: {
      recipient: true,
      corridor: { select: { isLive: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return jsonOk({ transfer: serializeTransfer(transfer, { includeTimeline: true }) });
});
