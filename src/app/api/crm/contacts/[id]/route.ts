import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { contactUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Contact not found" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  // userId is part of the lookup, so another user's row reads as missing.
  const contact = await db.contact.findFirst({ where: { id, userId }, include: { deals: true } });
  return contact ? NextResponse.json(contact) : notFound();
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { data, error } = await parseBody(req, contactUpdateSchema);
  if (error) return error;

  const existing = await db.contact.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  const contact = await db.contact.update({
    where: { id },
    data: { ...data, ...(data.email !== undefined ? { email: data.email || null } : {}) },
    include: { deals: true },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.contact.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  // Deals cascade with the contact via the schema's onDelete rule.
  await db.contact.delete({ where: { id } });
  return NextResponse.json({ id });
}
