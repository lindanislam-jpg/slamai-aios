import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, badRequest, serverError, parseBody } from "@/lib/voice/http";
import { agentSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "agent.read" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const agent = await db.receptionAgent.findFirst({
      where: { id, businessId: gate.ctx.businessId },
      include: { phoneNumbers: true },
    });
    if (!agent) return notFound("That AI receptionist no longer exists.");
    return ok({ agent });
  } catch (err) {
    return serverError("agents.get.one", err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "agent.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, agentSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const existing = await db.receptionAgent.findFirst({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (!existing) return notFound("That AI receptionist no longer exists.");

    // Going live without a number would silently do nothing, so say why.
    if (input.isActive === true) {
      const numbers = await db.phoneNumber.count({
        where: { businessId: gate.ctx.businessId, agentId: id, status: "active" },
      });
      if (numbers === 0) {
        return badRequest(
          "Connect a phone number to this receptionist before switching it on."
        );
      }
    }

    const agent = await db.receptionAgent.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.personality !== undefined && { personality: input.personality }),
        ...(input.voice !== undefined && { voice: input.voice }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.speakingRate !== undefined && { speakingRate: input.speakingRate }),
        ...(input.greeting !== undefined && { greeting: input.greeting }),
        ...(input.customInstructions !== undefined && {
          customInstructions: input.customInstructions || null,
        }),
        ...(input.emergencyInstructions !== undefined && {
          emergencyInstructions: input.emergencyInstructions || null,
        }),
        ...(input.afterHoursMode !== undefined && { afterHoursMode: input.afterHoursMode }),
        ...(input.bookingEnabled !== undefined && { bookingEnabled: input.bookingEnabled }),
        ...(input.leadCaptureEnabled !== undefined && { leadCaptureEnabled: input.leadCaptureEnabled }),
        ...(input.transferEnabled !== undefined && { transferEnabled: input.transferEnabled }),
        ...(input.transferNumber !== undefined && { transferNumber: input.transferNumber || null }),
        ...(input.fallbackNumber !== undefined && { fallbackNumber: input.fallbackNumber || null }),
        ...(input.transferTriggers !== undefined && {
          transferTriggers: JSON.stringify(input.transferTriggers),
        }),
        ...(input.maxTurns !== undefined && { maxTurns: input.maxTurns }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: input.isActive === true ? "agent.activated" : "agent.updated",
      entityType: "agent",
      entityId: id,
      metadata: { fields: Object.keys(input) },
      req,
    });

    return ok({ agent });
  } catch (err) {
    return serverError("agents.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "agent.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const remaining = await db.receptionAgent.count({ where: { businessId: gate.ctx.businessId } });
    if (remaining <= 1) {
      return badRequest("You need at least one AI receptionist. Edit this one instead of deleting it.");
    }

    const result = await db.receptionAgent.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That AI receptionist no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "agent.deleted",
      entityType: "agent",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("agents.delete", err);
  }
}
