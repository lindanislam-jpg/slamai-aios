import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const documents = await db.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, mode: true, size: true, summary: true, createdAt: true },
  });
  return NextResponse.json(documents);
}
