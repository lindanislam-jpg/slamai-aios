import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/voice/tenant";
import { ok, serverError } from "@/lib/voice/http";
import { periodKey } from "@/lib/voice/usage";
import { getVoicePlan } from "@/lib/voice/plans";

/** SlamAI's own view of the platform. Never reachable by a customer. */
export async function GET() {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);

  try {
    const [
      businesses, activeBusinesses, suspended, users, calls, callsThisMonth,
      leads, appointments, subscriptions, usage, failedNotifications, newDemoRequests,
    ] = await Promise.all([
      db.business.count(),
      db.business.count({ where: { status: "active" } }),
      db.business.count({ where: { status: "suspended" } }),
      db.user.count(),
      db.voiceCall.count(),
      db.voiceCall.count({ where: { startedAt: { gte: monthAgo } } }),
      db.lead.count(),
      db.appointment.count(),
      db.subscription.groupBy({ by: ["planId", "status"], _count: { _all: true } }),
      db.usageEvent.groupBy({
        by: ["metric"],
        where: { period: periodKey() },
        _sum: { quantity: true },
      }),
      db.notificationLog.count({ where: { status: "failed", createdAt: { gte: monthAgo } } }),
      db.demoRequest.count({ where: { status: "new" } }),
    ]);

    // Monthly recurring revenue from active paid subscriptions.
    const mrr = subscriptions
      .filter((s) => s.status === "active" || s.status === "trialing")
      .reduce((sum, s) => sum + getVoicePlan(s.planId).price * s._count._all, 0);

    return ok({
      businesses: { total: businesses, active: activeBusinesses, suspended },
      users,
      calls: { total: calls, last30Days: callsThisMonth },
      leads,
      appointments,
      subscriptions,
      mrr,
      usageThisPeriod: Object.fromEntries(usage.map((u) => [u.metric, u._sum.quantity ?? 0])),
      health: { failedNotifications, newDemoRequests },
    });
  } catch (err) {
    return serverError("admin.overview", err);
  }
}
