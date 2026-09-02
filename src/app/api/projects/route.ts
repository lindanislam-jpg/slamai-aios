import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { projectCreateSchema } from "@/lib/schemas";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const projects = await db.project.findMany({
    where: { userId },
    include: { tasks: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, projectCreateSchema);
  if (error) return error;

  const project = await db.project.create({
    data: { ...data, userId },
  });
  return NextResponse.json(project, { status: 201 });
}
