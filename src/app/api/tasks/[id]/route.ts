import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type TaskPatch = { title?: string; description?: string; status?: string; priority?: string; dueDate?: string | null };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<TaskPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.task.findFirst({ where: { id, project: { userId: gate.userId } } });
  if (!existing) return notFound("Task not found");

  const task = await db.task.update({
    where: { id },
    data: {
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.priority    !== undefined && { priority: body.priority }),
      ...(body.dueDate     !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.task.findFirst({ where: { id, project: { userId: gate.userId } } });
  if (!existing) return notFound("Task not found");

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
