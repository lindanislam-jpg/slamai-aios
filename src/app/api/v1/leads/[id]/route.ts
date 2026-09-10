import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError, parseBody } from "@/lib/voice/http";
import { leadSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "leads.read" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const lead = await db.lead.findFirst({
      where: { id, businessId: gate.ctx.businessId },
      include: {
        call: { select: { id: true, startedAt: true, durationSec: true, summary: true } },
        customer: { include: { appointments: { orderBy: { startsAt: "desc" }, take: 5 } } },
      },
    });
    if (!lead) return notFound("That lead no longer exists.");
    return ok({ lead });
  } catch (err) {
    return serverError("leads.get.one", err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "leads.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, leadSchema.partial());
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const result = await db.lead.updateMany({
      where: { id, businessId: gate.ctx.businessId },
      data: {
        ...(input.name !== undefined && { name: input.name || null }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(input.company !== undefined && { company: input.company || null }),
        ...(input.serviceRequested !== undefined && { serviceRequested: input.serviceRequested || null }),
        ...(input.summary !== undefined && { summary: input.summary || null }),
        ...(input.score !== undefined && { score: input.score }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue ?? null }),
        ...(input.urgency !== undefined && { urgency: input.urgency }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        lastInteractionAt: new Date(),
      },
    });
    if (result.count === 0) return notFound("That lead no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "lead.updated",
      entityType: "lead",
      entityId: id,
      metadata: { fields: Object.keys(input) },
      req,
    });

    const lead = await db.lead.findFirst({ where: { id, businessId: gate.ctx.businessId } });
    return ok({ lead });
  } catch (err) {
    return serverError("leads.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "leads.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.lead.deleteMany({ where: { id, businessId: gate.ctx.businessId } });
    if (result.count === 0) return notFound("That lead no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "lead.deleted",
      entityType: "lead",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("leads.delete", err);
  }
}
