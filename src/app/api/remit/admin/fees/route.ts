import { db } from "@/lib/db";
import { jsonOk, parseBody, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { Money } from "@/remit/money/money";
import { feeRuleSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/remit/admin/fees — every configured fee rule. */
export const GET = route(async () => {
  await requireAdmin(PERMISSIONS.MANAGE_FEES);
  const rules = await db.remitFeeRule.findMany({
    include: { corridor: { select: { sourceCountryCode: true, destCountryCode: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return jsonOk({
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      corridor: rule.corridor
        ? `${rule.corridor.sourceCountryCode} → ${rule.corridor.destCountryCode}`
        : "All corridors",
      corridorId: rule.corridorId,
      segment: rule.segment,
      promoCode: rule.promoCode,
      fixedFee: Money.fromMinor(rule.fixedFeeMinor, rule.currency).toJSON(),
      percentageBps: rule.percentageBps,
      minAmount: rule.minAmountMinor
        ? Money.fromMinor(rule.minAmountMinor, rule.currency).toJSON()
        : null,
      maxAmount: rule.maxAmountMinor
        ? Money.fromMinor(rule.maxAmountMinor, rule.currency).toJSON()
        : null,
      priority: rule.priority,
      isActive: rule.isActive,
    })),
  });
});

/** POST /api/remit/admin/fees — create a fee rule (e.g. a promo or business tier). */
export const POST = route(async (request) => {
  const { user } = await requireAdmin(PERMISSIONS.MANAGE_FEES);
  const input = await parseBody(request, feeRuleSchema);

  const rule = await db.remitFeeRule.create({
    data: {
      name: input.name,
      corridorId: input.corridorId ?? null,
      segment: input.segment ?? null,
      promoCode: input.promoCode ?? null,
      currency: input.currency,
      fixedFeeMinor: Money.fromDecimalString(input.fixedFee, input.currency).minor,
      percentageBps: input.percentageBps,
      minAmountMinor: input.minAmount
        ? Money.fromDecimalString(input.minAmount, input.currency).minor
        : null,
      maxAmountMinor: input.maxAmount
        ? Money.fromDecimalString(input.maxAmount, input.currency).minor
        : null,
      priority: input.priority,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    actorType: "ADMIN",
    actorId: user.id,
    action: "fee_rule.created",
    entityType: "RemitFeeRule",
    entityId: rule.id,
    metadata: { name: rule.name, fixedFee: input.fixedFee, priority: rule.priority },
  });

  return jsonOk({ id: rule.id }, 201);
});
