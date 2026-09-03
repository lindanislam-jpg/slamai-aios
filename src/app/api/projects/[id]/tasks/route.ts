import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { taskCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id: projectId } = await params;
  const { data, error } = await parseBody(req, taskCreateSchema);
  if (error) return error;

  // Ownership comes from the parent project, so a task cannot be added to
  // someone else's board.
  const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const task = await db.task.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      projectId,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
