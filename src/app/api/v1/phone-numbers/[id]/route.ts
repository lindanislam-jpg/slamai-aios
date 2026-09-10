import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError, parseBody } from "@/lib/voice/http";
import { phoneNumberSchema } from "@/lib/voice/validation";
import { getVoiceProvider } from "@/lib/voice/providers";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "phone.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, phoneNumberSchema.partial());
  if (!body.ok) return body.response;

  try {
    // An agent id from the client is only accepted if it belongs to this tenant.
    if (body.data.agentId) {
      const agent = await db.receptionAgent.findFirst({
        where: { id: body.data.agentId, businessId: gate.ctx.businessId },
        select: { id: true },
      });
      if (!agent) return notFound("That AI receptionist no longer exists.");
    }

    const result = await db.phoneNumber.updateMany({
      where: { id, businessId: gate.ctx.businessId },
      data: {
        ...(body.data.label !== undefined && { label: body.data.label || null }),
        ...(body.data.agentId !== undefined && { agentId: body.data.agentId }),
        ...(body.data.forwardTo !== undefined && { forwardTo: body.data.forwardTo || null }),
      },
    });
    if (result.count === 0) return notFound("That number is no longer connected.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "phone.updated",
      entityType: "phone_number",
      entityId: id,
      req,
    });

    const number = await db.phoneNumber.findFirst({ where: { id, businessId: gate.ctx.businessId } });
    return ok({ number });
  } catch (err) {
    return serverError("numbers.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "phone.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const number = await db.phoneNumber.findFirst({ where: { id, businessId: gate.ctx.businessId } });
    if (!number) return notFound("That number is no longer connected.");

    // Give the number back to the carrier if we bought it, so it stops billing.
    const provider = getVoiceProvider();
    if (number.providerSid && provider.isConfigured()) {
      await provider.releaseNumber(number.providerSid).catch((err) => {
        console.error("[numbers] provider release failed; disconnecting locally", err);
      });
    }

    await db.phoneNumber.delete({ where: { id: number.id } });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "phone.released",
      entityType: "phone_number",
      entityId: id,
      metadata: { e164: number.e164 },
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("numbers.delete", err);
  }
}
