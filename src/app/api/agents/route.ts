import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { agentCreateSchema } from "@/lib/schemas";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const agents = await db.aIAgent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, agentCreateSchema);
  if (error) return error;

  const agent = await db.aIAgent.create({
    data: { ...data, model: data.model || "gpt-4o", userId },
  });
  return NextResponse.json(agent, { status: 201 });
}
