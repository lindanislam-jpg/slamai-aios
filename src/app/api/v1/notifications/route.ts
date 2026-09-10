import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody } from "@/lib/voice/http";
import { notificationRuleSchema } from "@/lib/voice/validation";
import { isEmailConfigured, isSmsConfigured } from "@/lib/voice/notifications";
import { recordAudit } from "@/lib/voice/audit";

export async function GET() {
  const gate = await requireTenant({ permission: "business.read" });
  if (!gate.ok) return gate.response;

  try {
    const [rules, recent] = await Promise.all([
      db.notificationRule.findMany({
        where: { businessId: gate.ctx.businessId },
        orderBy: { createdAt: "asc" },
      }),
      db.notificationLog.findMany({
        where: { businessId: gate.ctx.businessId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return ok({
      rules,
      recent,
      transports: { email: isEmailConfigured(), sms: isSmsConfigured(), webhook: true },
    });
  } catch (err) {
    return serverError("notifications.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, notificationRuleSchema);
  if (!body.ok) return body.response;

  try {
    const rule = await db.notificationRule.upsert({
      where: {
        businessId_event_channel_target: {
          businessId: gate.ctx.businessId,
          event: body.data.event,
          channel: body.data.channel,
          target: body.data.target,
        },
      },
      update: { isActive: body.data.isActive },
      create: { businessId: gate.ctx.businessId, ...body.data },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "notification_rule.saved",
      entityType: "notification_rule",
      entityId: rule.id,
      req,
    });

    return ok({ rule }, 201);
  } catch (err) {
    return serverError("notifications.post", err);
  }
}
