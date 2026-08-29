import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const [agents, installs] = await Promise.all([
    db.marketplaceAgent.findMany({
      where: { isActive: true },
      orderBy: { installs: "desc" },
    }),
    db.agentInstall.findMany({ where: { userId: gate.userId }, select: { agentId: true } }),
  ]);

  const installed = new Set(installs.map((i) => i.agentId));

  return NextResponse.json(
    agents.map((agent) => ({ ...agent, installed: installed.has(agent.id) }))
  );
}
