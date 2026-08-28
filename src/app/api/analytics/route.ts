import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `count` months, oldest first, as {key, label} where key is "YYYY-M". */
function recentMonths(count: number) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()] });
  }
  return months;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.userId;

  const months = recentMonths(6);
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [deals, contacts, campaigns, agents, conversations] = await Promise.all([
    db.deal.findMany({
      where: { contact: { userId } },
      select: { value: true, stage: true, createdAt: true },
    }),
    db.contact.findMany({
      where: { userId },
      select: { stage: true, score: true, createdAt: true },
    }),
    db.campaign.findMany({
      where: { userId },
      select: { platform: true, reach: true, engagement: true, status: true },
    }),
    db.aIAgent.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
    db.conversation.findMany({
      where: { userId },
      select: { agentId: true, _count: { select: { messages: true } } },
    }),
  ]);

  // Revenue and new leads per month.
  const revenueByMonth = new Map(months.map((m) => [m.key, 0]));
  const leadsByMonth   = new Map(months.map((m) => [m.key, 0]));

  for (const deal of deals) {
    if (deal.stage !== "won") continue;
    const key = monthKey(deal.createdAt);
    if (revenueByMonth.has(key)) revenueByMonth.set(key, revenueByMonth.get(key)! + deal.value);
  }
  for (const contact of contacts) {
    const key = monthKey(contact.createdAt);
    if (leadsByMonth.has(key)) leadsByMonth.set(key, leadsByMonth.get(key)! + 1);
  }

  const revenueSeries = months.map((m) => ({
    month:   m.label,
    revenue: Math.round(revenueByMonth.get(m.key) || 0),
    leads:   leadsByMonth.get(m.key) || 0,
  }));

  // Pipeline split by stage.
  const stageCounts = new Map<string, number>();
  for (const c of contacts) stageCounts.set(c.stage, (stageCounts.get(c.stage) || 0) + 1);
  const pipeline = Array.from(stageCounts.entries()).map(([stage, count]) => ({ stage, count }));

  // Message volume per agent.
  const messagesByAgent = new Map<string, number>();
  for (const conv of conversations) {
    messagesByAgent.set(conv.agentId, (messagesByAgent.get(conv.agentId) || 0) + conv._count.messages);
  }
  const agentUsage = agents
    .map((a) => ({ name: a.name, messages: messagesByAgent.get(a.id) || 0 }))
    .sort((a, b) => b.messages - a.messages);

  // Marketing reach per platform.
  const reachByPlatform = new Map<string, { reach: number; engagement: number }>();
  for (const c of campaigns) {
    const platform = c.platform || "other";
    const entry = reachByPlatform.get(platform) || { reach: 0, engagement: 0 };
    entry.reach      += c.reach;
    entry.engagement += c.engagement;
    reachByPlatform.set(platform, entry);
  }
  const channels = Array.from(reachByPlatform.entries()).map(([platform, v]) => ({ platform, ...v }));

  const wonDeals    = deals.filter((d) => d.stage === "won");
  const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const openValue    = deals.filter((d) => d.stage !== "won" && d.stage !== "lost")
                            .reduce((sum, d) => sum + d.value, 0);
  const avgScore     = contacts.length
    ? Math.round(contacts.reduce((s, c) => s + c.score, 0) / contacts.length)
    : 0;
  const totalMessages = Array.from(messagesByAgent.values()).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    kpis: {
      totalRevenue,
      openPipeline:   openValue,
      wonDeals:       wonDeals.length,
      totalContacts:  contacts.length,
      avgLeadScore:   avgScore,
      conversionRate: contacts.length ? Math.round((wonDeals.length / contacts.length) * 100) : 0,
      totalMessages,
      activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    },
    revenueSeries,
    pipeline,
    agentUsage,
    channels,
    since: since.toISOString(),
  });
}
