import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const listing = await db.marketplaceAgent.findFirst({ where: { id, isActive: true } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const already = await db.aIAgent.findFirst({
    where: { userId, name: listing.name },
    select: { id: true },
  });
  if (already) {
    return NextResponse.json({ error: "You have already installed this agent" }, { status: 409 });
  }

  // Installing means getting a real, usable agent in your own hub.
  const [agent] = await db.$transaction([
    db.aIAgent.create({
      data: {
        name: listing.name,
        type: listing.agentType,
        description: listing.description,
        systemPrompt: listing.systemPrompt || `You are ${listing.name}. ${listing.description}`,
        userId,
      },
    }),
    db.marketplaceAgent.update({
      where: { id },
      data: { installs: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ agent }, { status: 201 });
}
