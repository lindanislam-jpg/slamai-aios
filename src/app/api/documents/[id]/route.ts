import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.document.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await db.document.delete({ where: { id } });
  return NextResponse.json({ id });
}
