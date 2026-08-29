import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

type ContactPatch = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  stage?: string;
  score?: number;
  tags?: string;
  notes?: string;
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<ContactPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.contact.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Contact not found");

  const contact = await db.contact.update({
    where: { id },
    data: pick(body, ["name", "email", "phone", "company", "stage", "score", "tags", "notes"]),
    include: { deals: true },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.contact.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Contact not found");

  await db.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
