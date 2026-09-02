import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { agentUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Agent not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const agent = await db.aIAgent.findFirst({ where: { id, userId } });
  return agent ? NextResponse.json(agent) : notFound();
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { data, error } = await parseBody(req, agentUpdateSchema);
  if (error) return error;

  const existing = await db.aIAgent.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  const agent = await db.aIAgent.update({ where: { id }, data });
  return NextResponse.json(agent);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.aIAgent.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  // Conversations and their messages cascade with the agent.
  await db.aIAgent.delete({ where: { id } });
  return NextResponse.json({ id });
}
