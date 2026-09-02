import { db } from "./db";

export const RANGES = ["7D", "1M", "3M", "1Y"] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | null): Range {
  return (RANGES as readonly string[]).includes(value ?? "") ? (value as Range) : "3M";
}

/** A deal counts as booked revenue once it reaches this stage. */
const WON = "won";
const LOST = "lost";

/** CRM funnel order, used to sort the pipeline breakdown. */
export const STAGE_ORDER = ["lead", "prospect", "qualified", "proposal", "won"];

interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Buckets for a range, oldest first, ending with the one containing `now`.
 * Short ranges bucket by day, 3M by week and 1Y by calendar month, so every
 * range yields a readable number of points.
 */
function buildBuckets(range: Range, now: Date): Bucket[] {
  const out: Bucket[] = [];

  if (range === "1Y") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ start, end, label: start.toLocaleString("en-IE", { month: "short" }) });
    }
    return out;
  }

  const dayMs = 86_400_000;
  const tomorrow = new Date(startOfDay(now).getTime() + dayMs);
  const { count, sizeDays } =
    range === "7D" ? { count: 7, sizeDays: 1 }
    : range === "1M" ? { count: 30, sizeDays: 1 }
    : { count: 13, sizeDays: 7 };

  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(tomorrow.getTime() - i * sizeDays * dayMs);
    const start = new Date(end.getTime() - sizeDays * dayMs);
    out.push({
      start,
      end,
      label: start.toLocaleString("en-IE", { day: "numeric", month: "short" }),
    });
  }
  return out;
}

/** Percentage change, or null when there is no prior baseline to compare to. */
function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function countBetween(dates: Date[], start: Date, end: Date) {
  return dates.filter(d => d >= start && d < end).length;
}

function sumBetween(rows: { at: Date; value: number }[], start: Date, end: Date) {
  return rows.reduce((acc, r) => (r.at >= start && r.at < end ? acc + r.value : acc), 0);
}

export async function getAnalytics(userId: string, range: Range) {
  const now = new Date();
  const buckets = buildBuckets(range, now);
  const periodStart = buckets[0].start;
  const periodEnd = buckets[buckets.length - 1].end;
  // Equal-length window immediately before this one, for the change figures.
  const periodMs = periodEnd.getTime() - periodStart.getTime();
  const prevStart = new Date(periodStart.getTime() - periodMs);

  const [deals, contacts, messages, agents, campaigns] = await Promise.all([
    db.deal.findMany({
      where: { contact: { userId } },
      select: { value: true, stage: true, closeDate: true, createdAt: true },
    }),
    db.contact.findMany({
      where: { userId },
      select: { createdAt: true, stage: true },
    }),
    db.message.findMany({
      where: { conversation: { userId }, role: "assistant" },
      select: { createdAt: true, conversation: { select: { agent: { select: { name: true } } } } },
    }),
    db.aIAgent.findMany({ where: { userId }, select: { name: true, isActive: true } }),
    db.campaign.findMany({ where: { userId }, select: { reach: true, engagement: true } }),
  ]);

  // A deal is booked on its close date when it has one, else when it was created.
  const wonDeals = deals
    .filter(d => d.stage === WON)
    .map(d => ({ at: d.closeDate ?? d.createdAt, value: d.value }));
  const openDeals = deals.filter(d => d.stage !== WON && d.stage !== LOST);
  const contactDates = contacts.map(c => c.createdAt);
  const messageDates = messages.map(m => m.createdAt);

  const series = buckets.map(b => ({
    label: b.label,
    revenue: sumBetween(wonDeals, b.start, b.end),
    leads: countBetween(contactDates, b.start, b.end),
    aiMessages: countBetween(messageDates, b.start, b.end),
  }));

  const current = {
    revenue: sumBetween(wonDeals, periodStart, periodEnd),
    leads: countBetween(contactDates, periodStart, periodEnd),
    aiMessages: countBetween(messageDates, periodStart, periodEnd),
  };
  const previous = {
    revenue: sumBetween(wonDeals, prevStart, periodStart),
    leads: countBetween(contactDates, prevStart, periodStart),
    aiMessages: countBetween(messageDates, prevStart, periodStart),
  };

  // Pipeline by contact stage — the real distribution behind the funnel.
  const stageCounts = new Map<string, number>();
  for (const c of contacts) {
    stageCounts.set(c.stage, (stageCounts.get(c.stage) ?? 0) + 1);
  }
  // Ordered by funnel position, not by size, so the ordinal colour ramp on the
  // chart reads light-to-dark down the funnel.
  const stageRank = (s: string) => {
    const i = STAGE_ORDER.indexOf(s.toLowerCase());
    return i === -1 ? STAGE_ORDER.length : i;
  };
  const pipeline = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.stage.localeCompare(b.stage));

  // Assistant replies per agent, over the selected period.
  const usage = new Map<string, number>();
  for (const m of messages) {
    if (m.createdAt < periodStart || m.createdAt >= periodEnd) continue;
    const name = m.conversation?.agent?.name ?? "Unknown agent";
    usage.set(name, (usage.get(name) ?? 0) + 1);
  }
  const agentUsage = [...usage.entries()]
    .map(([name, messages]) => ({ name, messages }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 8);

  const closedDeals = deals.filter(d => d.stage === WON || d.stage === LOST).length;
  const wonCount = deals.filter(d => d.stage === WON).length;
  const totalReach = campaigns.reduce((a, c) => a + c.reach, 0);
  const totalEngagement = campaigns.reduce((a, c) => a + c.engagement, 0);

  return {
    range,
    generatedAt: now.toISOString(),
    kpis: {
      revenue:    { value: current.revenue,    changePct: changePct(current.revenue, previous.revenue) },
      leads:      { value: current.leads,      changePct: changePct(current.leads, previous.leads) },
      aiMessages: { value: current.aiMessages, changePct: changePct(current.aiMessages, previous.aiMessages) },
      pipelineValue: { value: openDeals.reduce((a, d) => a + d.value, 0), changePct: null },
    },
    series,
    pipeline,
    agentUsage,
    summary: {
      totalContacts: contacts.length,
      openDeals: openDeals.length,
      winRatePct: closedDeals ? Math.round((wonCount / closedDeals) * 100) : null,
      avgDealValue: wonCount ? Math.round(wonDeals.reduce((a, d) => a + d.value, 0) / wonCount) : 0,
      activeAgents: agents.filter(a => a.isActive).length,
      campaignReach: totalReach,
      engagementRatePct: totalReach ? Math.round((totalEngagement / totalReach) * 1000) / 10 : null,
    },
  };
}

export type AnalyticsPayload = Awaited<ReturnType<typeof getAnalytics>>;
