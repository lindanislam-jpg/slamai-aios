import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, notFound } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.document.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Document not found");

  await db.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
