import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, forbidden, serverError, parseBody } from "@/lib/voice/http";
import { agentSchema } from "@/lib/voice/validation";
import { getVoicePlan, isWithinLimit } from "@/lib/voice/plans";
import { recordAudit } from "@/lib/voice/audit";

export async function GET() {
  const gate = await requireTenant({ permission: "agent.read" });
  if (!gate.ok) return gate.response;

  try {
    const agents = await db.receptionAgent.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        phoneNumbers: { select: { id: true, e164: true, status: true } },
        _count: { select: { calls: true } },
      },
    });
    return ok({ agents });
  } catch (err) {
    return serverError("agents.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "agent.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, agentSchema);
  if (!body.ok) return body.response;

  try {
    const plan = getVoicePlan(gate.ctx.planId);
    const count = await db.receptionAgent.count({ where: { businessId: gate.ctx.businessId } });
    if (!isWithinLimit(plan.limits.agents, count)) {
      return forbidden(
        `Your ${plan.name} plan includes ${plan.limits.agents} AI receptionist${plan.limits.agents === 1 ? "" : "s"}. Upgrade to add more.`
      );
    }

    const business = await db.business.findUnique({
      where: { id: gate.ctx.businessId },
      select: { name: true },
    });

    const agent = await db.receptionAgent.create({
      data: {
        businessId: gate.ctx.businessId,
        name: body.data.name ?? "AI Receptionist",
        greeting:
          body.data.greeting ??
          `Hi, thanks for calling ${business?.name ?? "us"}. I'm the AI assistant here — how can I help you today?`,
        ...(body.data.personality && { personality: body.data.personality }),
        ...(body.data.voice && { voice: body.data.voice }),
        ...(body.data.transferTriggers && {
          transferTriggers: JSON.stringify(body.data.transferTriggers),
        }),
        isDefault: count === 0,
        isActive: false,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "agent.created",
      entityType: "agent",
      entityId: agent.id,
      req,
    });

    return ok({ agent }, 201);
  } catch (err) {
    return serverError("agents.post", err);
  }
}
