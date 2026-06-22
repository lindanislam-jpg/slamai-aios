import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = await db.aIAgent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, description, systemPrompt, model } = await req.json();
  if (!name || !type) return NextResponse.json({ error: "Name and type required" }, { status: 400 });

  const agent = await db.aIAgent.create({
    data: { name, type, description, systemPrompt, model: model || "gpt-4o", userId: session.user.id },
  });
  return NextResponse.json(agent, { status: 201 });
}
