import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError } from "@/lib/voice/http";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.notificationRule.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That notification is already off.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "notification_rule.deleted",
      entityType: "notification_rule",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("notifications.delete", err);
  }
}
