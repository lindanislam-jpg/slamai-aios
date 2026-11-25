import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError, parseBody } from "@/lib/voice/http";
import { serviceSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, serviceSchema.partial());
  if (!body.ok) return body.response;

  try {
    // Scoping the update to the tenant means another business's id simply
    // matches nothing, rather than being edited.
    const result = await db.service.updateMany({
      where: { id, businessId: gate.ctx.businessId },
      data: {
        ...(body.data.name !== undefined && { name: body.data.name }),
        ...(body.data.description !== undefined && { description: body.data.description || null }),
        ...(body.data.price !== undefined && { price: body.data.price ?? null }),
        ...(body.data.priceNote !== undefined && { priceNote: body.data.priceNote || null }),
        ...(body.data.durationMin !== undefined && { durationMin: body.data.durationMin }),
        ...(body.data.isActive !== undefined && { isActive: body.data.isActive }),
      },
    });
    if (result.count === 0) return notFound("That service no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "service.updated",
      entityType: "service",
      entityId: id,
      req,
    });

    const service = await db.service.findFirst({ where: { id, businessId: gate.ctx.businessId } });
    return ok({ service });
  } catch (err) {
    return serverError("services.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.service.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That service no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "service.deleted",
      entityType: "service",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("services.delete", err);
  }
}
