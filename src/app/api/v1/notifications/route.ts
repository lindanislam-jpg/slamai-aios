import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError, parseBody } from "@/lib/voice/http";
import { notificationRuleSchema } from "@/lib/voice/validation";
import { isEmailConfigured, isSmsConfigured } from "@/lib/voice/notifications";
import { recordAudit } from "@/lib/voice/audit";
import { approveUrl, BlockedAddressError } from "@/lib/voice/egress";

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

  // A webhook rule is a URL the server will fetch, so it is held to the same
  // egress rule as a registered endpoint. Refusing it here rather than at
  // send time also means the owner finds out while they are looking at it.
  if (body.data.channel === "webhook") {
    try {
      await approveUrl(body.data.target);
    } catch (err) {
      if (err instanceof BlockedAddressError) return badRequest(err.message);
      return badRequest("That URL could not be checked. Use a publicly reachable https address.");
    }
  }

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
