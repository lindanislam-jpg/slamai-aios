import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";

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

// Only these fields are accepted; spreading the raw body would let a client
// set ids, timestamps, or another user's ownership.
const schema = z.object({
  name:    z.string().min(1, "Name required"),
  email:   z.string().email("Invalid email").optional().or(z.literal("")),
  phone:   z.string().optional(),
  company: z.string().optional(),
  stage:   z.string().optional(),
  score:   z.number().int().min(0).max(100).optional(),
  tags:    z.string().optional(),
  notes:   z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const contact = await db.contact.create({
    data: { ...data, email: data.email || null, userId },
  });
  return NextResponse.json(contact, { status: 201 });
}
