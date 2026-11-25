import { db } from "@/lib/db";
import { jsonOk, notFound, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/remit/transfers/:id — one transfer, with its full timeline. */
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

  // Scoped by customer id, so an id from another account reads as "not found"
  // rather than confirming the transfer exists.
  if (!transfer || transfer.customerId !== customer.id) throw notFound("Transfer not found");

  return jsonOk({ transfer: serializeTransfer(transfer, { includeTimeline: true }) });
});
