import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";

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

const schema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const project = await db.project.create({
    data: { ...data, userId },
  });
  return NextResponse.json(project, { status: 201 });
}
