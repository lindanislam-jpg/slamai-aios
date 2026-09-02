import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";
import { getAnalytics } from "@/lib/analytics";

/** Most recent records across the workspace, merged into one feed. */
async function getRecentActivity(userId: string) {
  const take = 5;
  const [contacts, conversations, documents, campaigns, projects] = await Promise.all([
    db.contact.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { name: true, createdAt: true } }),
    db.conversation.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take,
      select: { title: true, createdAt: true, agent: { select: { name: true } } },
    }),
    db.document.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { name: true, createdAt: true } }),
    db.campaign.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { name: true, platform: true, createdAt: true } }),
    db.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { name: true, createdAt: true } }),
  ]);

  const feed = [
    ...contacts.map(c => ({ kind: "contact" as const, label: `New contact added: ${c.name}`, at: c.createdAt })),
    ...conversations.map(c => ({
      kind: "agent" as const,
      label: `${c.agent?.name ?? "Agent"}: ${c.title || "new conversation"}`,
      at: c.createdAt,
    })),
    ...documents.map(d => ({ kind: "document" as const, label: `Document analysed: ${d.name}`, at: d.createdAt })),
    ...campaigns.map(c => ({
      kind: "campaign" as const,
      label: `Campaign created: ${c.name}${c.platform ? ` (${c.platform})` : ""}`,
      at: c.createdAt,
    })),
    ...projects.map(p => ({ kind: "project" as const, label: `Project started: ${p.name}`, at: p.createdAt })),
  ];

  return feed
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6)
    .map(item => ({ ...item, at: item.at.toISOString() }));
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const [agents, contacts, documents, campaigns, projects, conversations] = await Promise.all([
    db.aIAgent.count({ where: { userId } }),
    db.contact.count({ where: { userId } }),
    db.document.count({ where: { userId } }),
    db.campaign.count({ where: { userId } }),
    db.project.count({ where: { userId } }),
    db.conversation.count({ where: { userId } }),
  ]);

  // Revenue means booked revenue: won deals only. Summing every deal counted
  // prospects and proposals that may never close.
  const [wonDeals, allDeals] = await Promise.all([
    db.deal.aggregate({
      where: { contact: { userId }, stage: "won" },
      _sum: { value: true },
      _count: true,
    }),
    db.deal.count({ where: { contact: { userId } } }),
  ]);

  // Reuse the analytics aggregation so the dashboard chart and the analytics
  // page cannot drift apart.
  const [analytics, activity] = await Promise.all([
    getAnalytics(userId, "1Y"),
    getRecentActivity(userId),
  ]);

  return NextResponse.json({
    agents,
    contacts,
    documents,
    campaigns,
    projects,
    conversations,
    totalRevenue:  wonDeals._sum.value || 0,
    wonDeals:      wonDeals._count,
    totalDeals:    allDeals,
    // Last 6 calendar months of the 12-month series.
    series: analytics.series.slice(-6),
    changes: {
      revenue: analytics.kpis.revenue.changePct,
      leads:   analytics.kpis.leads.changePct,
    },
    activity,
  });
}
