import "server-only";
import { db } from "@/lib/db";
import { getVoicePlan } from "./plans";
import { METRICS, type Metric } from "./metrics";

/**
 * Usage metering. Every billable action writes a UsageEvent row; the usage and
 * billing pages aggregate those rows per period.
 *
 * Recording is append-only and there is no unique constraint on `refId`, so
 * this function is NOT idempotent on its own: `refId` only records which
 * entity a row came from, for reconciliation. Callers that can be re-entered
 * by a retried webhook must claim the work themselves before metering it —
 * see `finaliseCall` in ./call-flow.ts.
 */

export { METRICS, METRIC_LABELS } from "./metrics";
export type { Metric } from "./metrics";

/** The billing period key for a date, in UTC. */
export function periodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function recordUsage(
  businessId: string,
  metric: Metric,
  quantity: number,
  refId?: string
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return;
  try {
    await db.usageEvent.create({
      data: { businessId, metric, quantity, period: periodKey(), refId: refId ?? null },
    });
  } catch (err) {
    console.error("[usage] failed to record", metric, err);
  }
}

export type UsageSummary = {
  period: string;
  totals: Record<Metric, number>;
  minutesIncluded: number | null;
  minutesUsed: number;
  minutesPercent: number | null;
  overageMinutes: number;
  estimatedOverageCost: number;
};

export async function getUsageSummary(
  businessId: string,
  planId: string,
  minutesOverride?: number | null,
  period = periodKey()
): Promise<UsageSummary> {
  const rows = await db.usageEvent.groupBy({
    by: ["metric"],
    where: { businessId, period },
    _sum: { quantity: true },
  });

  const totals = Object.fromEntries(METRICS.map((m) => [m, 0])) as Record<Metric, number>;
  for (const row of rows) {
    if ((METRICS as readonly string[]).includes(row.metric)) {
      totals[row.metric as Metric] = row._sum.quantity ?? 0;
    }
  }

  const plan = getVoicePlan(planId);
  const included = minutesOverride ?? plan.limits.minutes;
  const used = totals.voice_minutes;
  const overage = included === null ? 0 : Math.max(0, used - included);

  return {
    period,
    totals,
    minutesIncluded: included,
    minutesUsed: used,
    minutesPercent: included === null || included === 0 ? null : Math.round((used / included) * 100),
    overageMinutes: overage,
    estimatedOverageCost: overage * (plan.overagePerMinute ?? 0),
  };
}

/** True when the tenant has burned through its included minutes. */
export async function isOverMinutes(businessId: string, planId: string, minutesOverride?: number | null) {
  const summary = await getUsageSummary(businessId, planId, minutesOverride);
  return summary.minutesIncluded !== null && summary.minutesUsed >= summary.minutesIncluded;
}
