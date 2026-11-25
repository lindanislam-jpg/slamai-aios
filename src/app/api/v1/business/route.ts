import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody } from "@/lib/voice/http";
import { businessSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

export async function GET() {
  const gate = await requireTenant({ permission: "business.read" });
  if (!gate.ok) return gate.response;

  try {
    const business = await db.business.findUnique({
      where: { id: gate.ctx.businessId },
      include: {
        businessHours: { orderBy: { weekday: "asc" } },
        subscription: true,
        _count: { select: { agents: true, phoneNumbers: true, knowledgeSources: true, services: true } },
      },
    });
    return ok({ business, role: gate.ctx.role });
  } catch (err) {
    return serverError("business.get", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, businessSchema);
  if (!body.ok) return body.response;

  try {
    // Only the validated keys are written — a client cannot set status or
    // isDemo by adding them to the payload.
    const business = await db.business.update({
      where: { id: gate.ctx.businessId },
      data: body.data,
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "business.updated",
      entityType: "business",
      entityId: business.id,
      metadata: { fields: Object.keys(body.data) },
      req,
    });

    return ok({ business });
  } catch (err) {
    return serverError("business.patch", err);
  }
}
