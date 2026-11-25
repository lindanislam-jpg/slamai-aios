import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/voice/tenant";
import { ok, notFound, serverError, parseBody } from "@/lib/voice/http";
import { z } from "zod";
import { VOICE_PLANS } from "@/lib/voice/plans";
import { recordAudit } from "@/lib/voice/audit";
import { periodKey } from "@/lib/voice/usage";

type Params = { params: Promise<{ id: string }> };

const adminUpdateSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  suspendReason: z.string().max(500).optional(),
  planId: z.enum(VOICE_PLANS.map((p) => p.id) as unknown as [string, ...string[]]).optional(),
  minutesOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const business = await db.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
        phoneNumbers: true,
        agents: { select: { id: true, name: true, isActive: true } },
        _count: { select: { calls: true, leads: true, appointments: true, knowledgeSources: true } },
      },
    });
    if (!business) return notFound("That workspace no longer exists.");

    const usage = await db.usageEvent.groupBy({
      by: ["metric"],
      where: { businessId: id, period: periodKey() },
      _sum: { quantity: true },
    });

    return ok({
      business,
      usage: Object.fromEntries(usage.map((u) => [u.metric, u._sum.quantity ?? 0])),
    });
  } catch (err) {
    return serverError("admin.business.get", err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, adminUpdateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const business = await db.business.findUnique({ where: { id }, select: { id: true } });
    if (!business) return notFound("That workspace no longer exists.");

    if (input.status) {
      await db.business.update({
        where: { id },
        data: {
          status: input.status,
          suspendedAt: input.status === "suspended" ? new Date() : null,
          suspendReason: input.status === "suspended" ? input.suspendReason ?? null : null,
        },
      });
    }

    if (input.planId !== undefined || input.minutesOverride !== undefined) {
      await db.subscription.updateMany({
        where: { businessId: id },
        data: {
          ...(input.planId !== undefined && { planId: input.planId }),
          ...(input.minutesOverride !== undefined && { minutesOverride: input.minutesOverride }),
        },
      });
    }

    await recordAudit({
      businessId: id,
      userId: gate.userId,
      action: "admin.workspace_updated",
      entityType: "business",
      entityId: id,
      metadata: input,
      req,
    });

    const updated = await db.business.findUnique({ where: { id }, include: { subscription: true } });
    return ok({ business: updated });
  } catch (err) {
    return serverError("admin.business.patch", err);
  }
}
