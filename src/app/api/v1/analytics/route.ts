import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, queryParam } from "@/lib/voice/http";
import {
  getTimeseries, getOutcomeBreakdown, getSentimentBreakdown, getAIPerformance, getDashboardStats,
} from "@/lib/voice/analytics";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "analytics.read" });
  if (!gate.ok) return gate.response;

  const days = Math.min(365, Math.max(7, Number(queryParam(req, "days")) || 30));

  try {
    const [timeseries, outcomes, sentiment, performance, stats, leadValue] = await Promise.all([
      getTimeseries(gate.ctx.businessId, days),
      getOutcomeBreakdown(gate.ctx.businessId, days),
      getSentimentBreakdown(gate.ctx.businessId, days),
      getAIPerformance(gate.ctx.businessId, days),
      getDashboardStats(gate.ctx.businessId),
      db.lead.aggregate({
        where: { businessId: gate.ctx.businessId },
        _sum: { estimatedValue: true },
        _avg: { score: true },
        _count: { _all: true },
      }),
    ]);

    const qualified = await db.lead.count({
      where: { businessId: gate.ctx.businessId, status: { in: ["qualified", "booked", "won"] } },
    });

    return ok({
      days,
      timeseries,
      outcomes,
      sentiment,
      performance,
      stats,
      leads: {
        total: leadValue._count._all,
        qualified,
        averageScore: Math.round(leadValue._avg.score ?? 0),
        // Labelled an estimate wherever it is shown — it is the sum of values
        // the business itself entered, not money received.
        estimatedPipelineValue: leadValue._sum.estimatedValue ?? 0,
      },
      currency: gate.ctx.currency,
    });
  } catch (err) {
    return serverError("analytics", err);
  }
}
