import { db } from "@/lib/db";
import { jsonOk, notFound, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/remit/recipients/:id
 *
 * Archives rather than deletes: past transfers must keep pointing at the
 * recipient they were actually sent to, for record-keeping.
 */
export const DELETE = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const customer = await requireActiveCustomer();
  const { id } = await context.params;

  const recipient = await db.remitRecipient.findUnique({ where: { id } });
  if (!recipient || recipient.customerId !== customer.id) throw notFound("Recipient not found");

  await db.remitRecipient.update({ where: { id }, data: { isArchived: true } });
  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: "recipient.archived",
    entityType: "RemitRecipient",
    entityId: id,
  });

  return jsonOk({ archived: true });
});
