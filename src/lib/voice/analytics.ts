import "server-only";
import { db } from "@/lib/db";

/**
 * Analytics queries.
 *
 * Everything here is aggregated in the database rather than by loading rows
 * into memory, so a busy tenant with tens of thousands of calls stays fast.
 *
 * Revenue figures are *estimates* derived from lead values the business itself
 * set. They are labelled as estimates everywhere they are shown, and this
 * module never claims otherwise.
 */

export type DashboardStats = {
  callsToday: number;
  callsThisWeek: number;
  aiAnswered: number;
  missedCalls: number;
  leadsCaptured: number;
  appointmentsBooked: number;
  transfers: number;
  averageDurationSec: number;
  conversionRate: number;
  estimatedRevenue: number;
};

function startOfDayUtc(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  const today = startOfDayUtc();
  const weekAgo = startOfDayUtc(6);

  const [
    callsToday,
    weekCalls,
    aiAnswered,
    missed,
    leads,
    appointments,
    transfers,
    duration,
    revenue,
  ] = await Promise.all([
    db.voiceCall.count({ where: { businessId, startedAt: { gte: today } } }),
    db.voiceCall.count({ where: { businessId, startedAt: { gte: weekAgo } } }),
    db.voiceCall.count({ where: { businessId, startedAt: { gte: today }, aiHandled: true, status: "completed" } }),
    db.voiceCall.count({ where: { businessId, startedAt: { gte: today }, outcome: { in: ["missed", "failed"] } } }),
    db.lead.count({ where: { businessId, createdAt: { gte: today } } }),
    db.appointment.count({ where: { businessId, createdAt: { gte: today }, status: { in: ["pending", "confirmed"] } } }),
    db.voiceCall.count({ where: { businessId, startedAt: { gte: today }, transferred: true } }),
    db.voiceCall.aggregate({
      where: { businessId, startedAt: { gte: weekAgo }, durationSec: { gt: 0 } },
      _avg: { durationSec: true },
    }),
    db.lead.aggregate({
      where: { businessId, status: { in: ["booked", "won"] }, createdAt: { gte: weekAgo } },
      _sum: { estimatedValue: true },
    }),
  ]);

  const weekLeads = await db.lead.count({ where: { businessId, createdAt: { gte: weekAgo } } });

  return {
    callsToday,
    callsThisWeek: weekCalls,
    aiAnswered,
    missedCalls: missed,
    leadsCaptured: leads,
    appointmentsBooked: appointments,
    transfers,
    averageDurationSec: Math.round(duration._avg.durationSec ?? 0),
    conversionRate: weekCalls > 0 ? Math.round((weekLeads / weekCalls) * 100) : 0,
    estimatedRevenue: revenue._sum.estimatedValue ?? 0,
  };
}

export type TimeseriesPoint = {
  date: string;
  calls: number;
  leads: number;
  appointments: number;
  aiHandled: number;
  transferred: number;
};

/** Daily counts for the last `days` days, zero-filled so charts have no gaps. */
export async function getTimeseries(businessId: string, days = 30): Promise<TimeseriesPoint[]> {
  const from = startOfDayUtc(days - 1);

  const [calls, leads, appointments] = await Promise.all([
    db.voiceCall.findMany({
      where: { businessId, startedAt: { gte: from } },
      select: { startedAt: true, aiHandled: true, transferred: true },
    }),
    db.lead.findMany({ where: { businessId, createdAt: { gte: from } }, select: { createdAt: true } }),
    db.appointment.findMany({
      where: { businessId, createdAt: { gte: from } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, TimeseriesPoint>();
  for (let i = 0; i < days; i++) {
    const date = startOfDayUtc(days - 1 - i).toISOString().slice(0, 10);
    buckets.set(date, { date, calls: 0, leads: 0, appointments: 0, aiHandled: 0, transferred: 0 });
  }

  const key = (d: Date) => d.toISOString().slice(0, 10);

  for (const call of calls) {
    const point = buckets.get(key(call.startedAt));
    if (!point) continue;
    point.calls++;
    if (call.aiHandled) point.aiHandled++;
    if (call.transferred) point.transferred++;
  }
  for (const lead of leads) {
    const point = buckets.get(key(lead.createdAt));
    if (point) point.leads++;
  }
  for (const appointment of appointments) {
    const point = buckets.get(key(appointment.createdAt));
    if (point) point.appointments++;
  }

  return [...buckets.values()];
}

export async function getOutcomeBreakdown(businessId: string, days = 30) {
  const rows = await db.voiceCall.groupBy({
    by: ["outcome"],
    where: { businessId, startedAt: { gte: startOfDayUtc(days - 1) } },
    _count: { _all: true },
  });
  return rows.map((r) => ({ outcome: r.outcome, count: r._count._all }));
}

export async function getSentimentBreakdown(businessId: string, days = 30) {
  const rows = await db.voiceCall.groupBy({
    by: ["sentiment"],
    where: { businessId, startedAt: { gte: startOfDayUtc(days - 1) }, sentiment: { not: null } },
    _count: { _all: true },
  });
  return rows.map((r) => ({ sentiment: r.sentiment ?? "unknown", count: r._count._all }));
}

export type AIPerformance = {
  totalCalls: number;
  answeredWithoutHelp: number;
  escalationRate: number;
  bookingRate: number;
  leadCaptureRate: number;
  averageDurationSec: number;
  positiveSentimentRate: number;
};

export async function getAIPerformance(businessId: string, days = 30): Promise<AIPerformance> {
  const from = startOfDayUtc(days - 1);
  const where = { businessId, startedAt: { gte: from } };

  const [total, transferred, booked, withLead, positive, duration] = await Promise.all([
    db.voiceCall.count({ where }),
    db.voiceCall.count({ where: { ...where, transferred: true } }),
    db.voiceCall.count({ where: { ...where, outcome: "booked" } }),
    db.voiceCall.count({ where: { ...where, lead: { isNot: null } } }),
    db.voiceCall.count({ where: { ...where, sentiment: "positive" } }),
    db.voiceCall.aggregate({ where: { ...where, durationSec: { gt: 0 } }, _avg: { durationSec: true } }),
  ]);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return {
    totalCalls: total,
    answeredWithoutHelp: total - transferred,
    escalationRate: pct(transferred),
    bookingRate: pct(booked),
    leadCaptureRate: pct(withLead),
    averageDurationSec: Math.round(duration._avg.durationSec ?? 0),
    positiveSentimentRate: pct(positive),
  };
}

/** The newest activity, for the dashboard's live feed. */
export async function getRecentActivity(businessId: string, limit = 12) {
  const calls = await db.voiceCall.findMany({
    where: { businessId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true, fromNumber: true, startedAt: true, summary: true, outcome: true,
      durationSec: true, isEmergency: true,
      customer: { select: { name: true } },
      lead: { select: { score: true } },
      appointments: { select: { id: true }, take: 1 },
    },
  });
  return calls;
}
