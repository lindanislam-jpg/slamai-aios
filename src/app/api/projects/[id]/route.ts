import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { projectUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Project not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const project = await db.project.findFirst({ where: { id, userId }, include: { tasks: true } });
  return project ? NextResponse.json(project) : notFound();
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { data, error } = await parseBody(req, projectUpdateSchema);
  if (error) return error;

  const existing = await db.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  const project = await db.project.update({ where: { id }, data, include: { tasks: true } });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  // Tasks cascade with the project.
  await db.project.delete({ where: { id } });
  return NextResponse.json({ id });
}
