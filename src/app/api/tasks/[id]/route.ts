import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Task not found" }, { status: 404 });

/** A task belongs to the user who owns its project. */
const ownedBy = (id: string, userId: string) => ({ id, project: { userId } });

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { data, error } = await parseBody(req, taskUpdateSchema);
  if (error) return error;

  const existing = await db.task.findFirst({ where: ownedBy(id, userId), select: { id: true } });
  if (!existing) return notFound();

  const task = await db.task.update({
    where: { id },
    data: {
      ...data,
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.task.findFirst({ where: ownedBy(id, userId), select: { id: true } });
  if (!existing) return notFound();

  await db.task.delete({ where: { id } });
  return NextResponse.json({ id });
}
