import { db } from "@/lib/db";
import { jsonOk, notFound, parseBody, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ isActive: z.boolean() });

/**
 * PATCH /api/remit/admin/fees/:id — switch a rule on or off.
 * Rules are never deleted: a past quote references the rule that priced it.
 */
export const PATCH = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdmin(PERMISSIONS.MANAGE_FEES);
  const { id } = await context.params;
  const input = await parseBody(request, schema);

  const rule = await db.remitFeeRule.findUnique({ where: { id } });
  if (!rule) throw notFound("Fee rule not found");

  await db.remitFeeRule.update({ where: { id }, data: { isActive: input.isActive } });
  await recordAudit({
    actorType: "ADMIN",
    actorId: user.id,
    action: input.isActive ? "fee_rule.enabled" : "fee_rule.disabled",
    entityType: "RemitFeeRule",
    entityId: id,
    metadata: { name: rule.name },
  });

  return jsonOk({ isActive: input.isActive });
});
