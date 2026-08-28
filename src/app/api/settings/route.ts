import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { isOpenAIConfigured } from "@/lib/openai";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [agents, contacts, documents, projects] = await Promise.all([
    db.aIAgent.count({ where: { userId } }),
    db.contact.count({ where: { userId } }),
    db.document.count({ where: { userId } }),
    db.project.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    user,
    usage: { agents, contacts, documents, projects },
    // Booleans only — never expose the key values themselves.
    integrations: {
      openai:   isOpenAIConfigured(),
      stripe:   Boolean(process.env.STRIPE_SECRET_KEY),
      database: Boolean(process.env.DATABASE_URL),
    },
  });
}

const schema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name is too long"),
});

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const user = await db.user.update({
    where: { id: userId },
    data: { name: data.name },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json(user);
}
