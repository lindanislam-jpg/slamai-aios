import { db } from "@/lib/db";
import { jsonOk, notFound, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { advanceSandboxTransfer } from "@/remit/server/sandbox-simulator";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/transfers/:id/simulate
 *
 * Advances a SANDBOX transfer one step, standing in for the provider webhooks
 * that would arrive in production. Guarded three ways: the caller must own the
 * transfer, demo mode must be on, and the transfer must be a sandbox transfer.
 */
export const POST = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const customer = await requireActiveCustomer();
  const { id } = await context.params;

  const transfer = await db.remitTransfer.findUnique({ where: { id } });
  if (!transfer || transfer.customerId !== customer.id) throw notFound("Transfer not found");

  const result = await advanceSandboxTransfer(id);
  return jsonOk(result);
});
