import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody } from "@/lib/voice/http";
import { serviceSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

export async function GET() {
  const gate = await requireTenant({ permission: "business.read" });
  if (!gate.ok) return gate.response;

  try {
    const services = await db.service.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok({ services });
  } catch (err) {
    return serverError("services.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, serviceSchema);
  if (!body.ok) return body.response;

  try {
    const count = await db.service.count({ where: { businessId: gate.ctx.businessId } });
    const service = await db.service.create({
      data: {
        businessId: gate.ctx.businessId,
        name: body.data.name,
        description: body.data.description || null,
        price: body.data.price ?? null,
        priceNote: body.data.priceNote || null,
        durationMin: body.data.durationMin,
        isActive: body.data.isActive,
        sortOrder: count,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "service.created",
      entityType: "service",
      entityId: service.id,
      req,
    });

    return ok({ service }, 201);
  } catch (err) {
    return serverError("services.post", err);
  }
}
