import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

type AgentPatch = {
  name?: string;
  type?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  isActive?: boolean;
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<AgentPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.aIAgent.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Agent not found");

  const agent = await db.aIAgent.update({
    where: { id },
    data: pick(body, ["name", "type", "description", "systemPrompt", "model", "isActive"]),
  });
  return NextResponse.json(agent);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.aIAgent.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Agent not found");

  await db.aIAgent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
