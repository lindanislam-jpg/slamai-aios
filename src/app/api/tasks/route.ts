import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest, notFound } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const tasks = await db.task.findMany({
    where: { project: { userId: gate.userId } },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

type TaskBody = {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  projectId?: string;
};

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<TaskBody>(req);
  if (!body?.title || !body.projectId) return badRequest("title and projectId are required");

  const project = await db.project.findFirst({ where: { id: body.projectId, userId: gate.userId } });
  if (!project) return notFound("Project not found");

  const task = await db.task.create({
    data: {
      title:       body.title,
      description: body.description,
      status:      body.status   || "todo",
      priority:    body.priority || "medium",
      dueDate:     body.dueDate ? new Date(body.dueDate) : null,
      projectId:   body.projectId,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
