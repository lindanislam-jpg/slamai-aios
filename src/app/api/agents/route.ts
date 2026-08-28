import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const agents = await db.aIAgent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agents);
}

const schema = z.object({
  name: z.string().min(1, "Name and type required"),
  type: z.string().min(1, "Name and type required"),
  description:  z.string().optional(),
  systemPrompt: z.string().optional(),
  model:        z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const agent = await db.aIAgent.create({
    data: { ...data, model: data.model || "gpt-4o", userId },
  });
  return NextResponse.json(agent, { status: 201 });
}
