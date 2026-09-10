import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody } from "@/lib/voice/http";
import { z } from "zod";
import { recordAudit } from "@/lib/voice/audit";

const stepSchema = z.object({
  step: z.number().int().min(0).max(7),
  completed: z.boolean().optional(),
});

/** Tracks how far through the setup wizard a workspace has got. */
export async function PATCH(req: Request) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, stepSchema);
  if (!body.ok) return body.response;

  try {
    const business = await db.business.update({
      where: { id: gate.ctx.businessId },
      data: {
        onboardingStep: body.data.step,
        ...(body.data.completed !== undefined && { onboardingCompleted: body.data.completed }),
      },
      select: { onboardingStep: true, onboardingCompleted: true },
    });

    if (body.data.completed) {
      await recordAudit({
        businessId: gate.ctx.businessId,
        userId: gate.ctx.userId,
        action: "onboarding.completed",
        req,
      });
    }

    return ok({ business });
  } catch (err) {
    return serverError("onboarding", err);
  }
}
