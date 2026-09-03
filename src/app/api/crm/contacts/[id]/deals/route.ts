import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { dealCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id: contactId } = await params;
  const { data, error } = await parseBody(req, dealCreateSchema);
  if (error) return error;

  // Ownership comes from the parent contact.
  const contact = await db.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const deal = await db.deal.create({
    data: {
      ...data,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      contactId,
    },
  });
  return NextResponse.json(deal, { status: 201 });
}
