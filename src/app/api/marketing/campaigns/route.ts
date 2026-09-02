import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const campaigns = await db.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, type: true, status: true, content: true, createdAt: true },
  });
  return NextResponse.json(campaigns);
}
