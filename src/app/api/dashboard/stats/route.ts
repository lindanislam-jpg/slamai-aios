import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [agents, contacts, documents, campaigns, projects, conversations] = await Promise.all([
    db.aIAgent.count({ where: { userId } }),
    db.contact.count({ where: { userId } }),
    db.document.count({ where: { userId } }),
    db.campaign.count({ where: { userId } }),
    db.project.count({ where: { userId } }),
    db.conversation.count({ where: { userId } }),
  ]);

  const deals = await db.deal.aggregate({
    where: { contact: { userId } },
    _sum: { value: true },
    _count: true,
  });

  return NextResponse.json({
    agents,
    contacts,
    documents,
    campaigns,
    projects,
    conversations,
    totalRevenue:  deals._sum.value || 0,
    totalDeals:    deals._count,
  });
}
