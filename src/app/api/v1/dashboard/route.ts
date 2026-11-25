import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError } from "@/lib/voice/http";
import { getDashboardStats, getTimeseries, getRecentActivity, getOutcomeBreakdown } from "@/lib/voice/analytics";
import { getUsageSummary } from "@/lib/voice/usage";

export async function GET() {
  const gate = await requireTenant();
  if (!gate.ok) return gate.response;
  const { businessId } = gate.ctx;

  try {
    const [stats, timeseries, activity, outcomes, subscription, setup] = await Promise.all([
      getDashboardStats(businessId),
      getTimeseries(businessId, 14),
      getRecentActivity(businessId, 10),
      getOutcomeBreakdown(businessId, 30),
      db.subscription.findUnique({ where: { businessId } }),
      db.business.findUnique({
        where: { id: businessId },
        select: {
          name: true, isDemo: true, onboardingCompleted: true, timezone: true,
          _count: {
            select: {
              knowledgeSources: true, services: true,
              phoneNumbers: true, agents: true,
            },
          },
          agents: { select: { isActive: true } },
        },
      }),
    ]);

    const usage = await getUsageSummary(
      businessId,
      subscription?.planId ?? "trial",
      subscription?.minutesOverride
    );

    return ok({
      stats,
      timeseries,
      activity,
      outcomes,
      usage,
      business: setup,
      // What still needs doing before the phone can be answered.
      checklist: {
        knowledge: (setup?._count.knowledgeSources ?? 0) > 0,
        services: (setup?._count.services ?? 0) > 0,
        phone: (setup?._count.phoneNumbers ?? 0) > 0,
        agentLive: setup?.agents.some((a) => a.isActive) ?? false,
      },
      role: gate.ctx.role,
      timezone: gate.ctx.timezone,
    });
  } catch (err) {
    return serverError("dashboard", err);
  }
}
