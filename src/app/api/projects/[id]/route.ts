import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type ProjectPatch = { name?: string; description?: string; status?: string };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<ProjectPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.project.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Project not found");

  const project = await db.project.update({
    where: { id },
    data: pick(body, ["name", "description", "status"]),
    include: { tasks: true },
  });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.project.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Project not found");

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
