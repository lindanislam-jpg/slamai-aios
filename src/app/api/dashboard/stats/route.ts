import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.userId;

  const [agents, contacts, documents, campaigns, projects, conversations, workflows, websites] =
    await Promise.all([
      db.aIAgent.count({ where: { userId } }),
      db.contact.count({ where: { userId } }),
      db.document.count({ where: { userId } }),
      db.campaign.count({ where: { userId } }),
      db.project.count({ where: { userId } }),
      db.conversation.count({ where: { userId } }),
      db.workflow.count({ where: { userId, isActive: true } }),
      db.website.count({ where: { userId } }),
    ]);

  const deals = await db.deal.aggregate({
    where: { contact: { userId } },
    _sum: { value: true },
    _count: true,
  });

  const wonRevenue = await db.deal.aggregate({
    where: { contact: { userId }, stage: "won" },
    _sum: { value: true },
  });

  // Six-month revenue and lead series for the overview chart.
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_LABELS[d.getMonth()], revenue: 0, leads: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  const [wonDeals, recentContacts] = await Promise.all([
    db.deal.findMany({
      where: { contact: { userId }, stage: "won" },
      select: { value: true, createdAt: true },
    }),
    db.contact.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  for (const d of wonDeals) {
    const i = index.get(`${d.createdAt.getFullYear()}-${d.createdAt.getMonth()}`);
    if (i !== undefined) buckets[i].revenue += d.value;
  }
  for (const c of recentContacts) {
    const i = index.get(`${c.createdAt.getFullYear()}-${c.createdAt.getMonth()}`);
    if (i !== undefined) buckets[i].leads += 1;
  }

  // Recent activity, newest first across the record types that have a feed worth showing.
  const [newContacts, newAgents, newCampaigns, newDocuments] = await Promise.all([
    db.contact.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, company: true, createdAt: true } }),
    db.aIAgent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, createdAt: true } }),
    db.campaign.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, type: true, createdAt: true } }),
    db.document.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, createdAt: true } }),
  ]);

  const activity = [
    ...newContacts.map((c)  => ({ kind: "contact"  as const, text: `New contact: ${c.name}${c.company ? ` (${c.company})` : ""}`, at: c.createdAt })),
    ...newAgents.map((a)    => ({ kind: "agent"    as const, text: `Agent created: ${a.name}`,                                    at: a.createdAt })),
    ...newCampaigns.map((c) => ({ kind: "campaign" as const, text: `${c.type} campaign: ${c.name}`,                               at: c.createdAt })),
    ...newDocuments.map((d) => ({ kind: "document" as const, text: `Document added: ${d.name}`,                                   at: d.createdAt })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return NextResponse.json({
    agents,
    contacts,
    documents,
    campaigns,
    projects,
    conversations,
    activeWorkflows: workflows,
    websites,
    totalRevenue: wonRevenue._sum.value || 0,
    pipelineValue: deals._sum.value || 0,
    totalDeals: deals._count,
    chart: buckets.map(({ month, revenue, leads }) => ({ month, revenue: Math.round(revenue), leads })),
    activity,
  });
}
