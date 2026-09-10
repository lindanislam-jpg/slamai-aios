import { db } from "@/lib/db";
import { badRequest, jsonOk, notFound, parseBody, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { suspendCustomerSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/admin/customers/:id/suspend
 * Suspending blocks every transacting endpoint for that customer immediately —
 * `requireActiveCustomer` rejects them before any service code runs.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdmin(PERMISSIONS.SUSPEND_CUSTOMERS);
  const { id } = await context.params;
  const input = await parseBody(request, suspendCustomerSchema);

  const customer = await db.remitCustomer.findUnique({ where: { id } });
  if (!customer) throw notFound("Customer not found");
  if (input.suspended && !input.reason) throw badRequest("A suspension needs a reason");

  const updated = await db.remitCustomer.update({
    where: { id },
    data: input.suspended
      ? { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: input.reason }
      : { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
  });

  await recordAudit({
    actorType: "ADMIN",
    actorId: user.id,
    action: input.suspended ? "customer.suspended" : "customer.reinstated",
    entityType: "RemitCustomer",
    entityId: id,
    metadata: { reason: input.reason ?? null },
  });

  return jsonOk({ status: updated.status });
});
