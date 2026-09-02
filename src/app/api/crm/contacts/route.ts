import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { contactCreateSchema } from "@/lib/schemas";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const contacts = await db.contact.findMany({
    where: { userId },
    include: { deals: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, contactCreateSchema);
  if (error) return error;

  const contact = await db.contact.create({
    data: { ...data, email: data.email || null, userId },
  });
  return NextResponse.json(contact, { status: 201 });
}
