import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type WorkflowPatch = { name?: string; description?: string; trigger?: string; action?: string; isActive?: boolean };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<WorkflowPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.workflow.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Workflow not found");

  const workflow = await db.workflow.update({
    where: { id },
    data: pick(body, ["name", "description", "trigger", "action", "isActive"]),
  });
  return NextResponse.json(workflow);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.workflow.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Workflow not found");

  await db.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
