import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError, parseBody } from "@/lib/voice/http";
import { webhookEndpointSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "integrations.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, webhookEndpointSchema.partial());
  if (!body.ok) return body.response;

  try {
    const result = await db.webhookEndpoint.updateMany({
      where: { id, businessId: gate.ctx.businessId },
      data: {
        ...(body.data.name !== undefined && { name: body.data.name }),
        ...(body.data.url !== undefined && { url: body.data.url }),
        ...(body.data.events !== undefined && { events: JSON.stringify(body.data.events) }),
        ...(body.data.isActive !== undefined && { isActive: body.data.isActive, failureCount: 0 }),
      },
    });
    if (result.count === 0) return notFound("That endpoint no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "webhook.updated",
      entityType: "webhook_endpoint",
      entityId: id,
      req,
    });

    return ok({ updated: true });
  } catch (err) {
    return serverError("webhooks.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "integrations.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.webhookEndpoint.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That endpoint no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "webhook.deleted",
      entityType: "webhook_endpoint",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("webhooks.delete", err);
  }
}
