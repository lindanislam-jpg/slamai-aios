import { db } from "@/lib/db";
import { jsonOk, notFound, parseBody, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { Money } from "@/remit/money/money";
import { corridorUpdateSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** PATCH /api/remit/admin/corridors/:id — limits, FX margin and availability. */
export const PATCH = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdmin(PERMISSIONS.MANAGE_CORRIDORS);
  const { id } = await context.params;
  const input = await parseBody(request, corridorUpdateSchema);

  const corridor = await db.remitCorridor.findUnique({ where: { id } });
  if (!corridor) throw notFound("Corridor not found");

  const toMinor = (value?: string) =>
    value ? Money.fromDecimalString(value, corridor.sourceCurrency).minor : undefined;

  await db.remitCorridor.update({
    where: { id },
    data: {
      isActive: input.isActive ?? undefined,
      fxMarginBps: input.fxMarginBps ?? undefined,
      minAmountMinor: toMinor(input.minAmount),
      maxAmountMinor: toMinor(input.maxAmount),
      dailyLimitMinor: toMinor(input.dailyLimit),
      monthlyLimitMinor: toMinor(input.monthlyLimit),
    },
  });

  await recordAudit({
    actorType: "ADMIN",
    actorId: user.id,
    action: "corridor.updated",
    entityType: "RemitCorridor",
    entityId: id,
    metadata: { ...input },
  });

  return jsonOk({ updated: true });
});
