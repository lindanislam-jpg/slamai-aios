import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest, notFound } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const deals = await db.deal.findMany({
    where: { contact: { userId: gate.userId } },
    include: { contact: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(deals);
}

type DealBody = { title?: string; value?: number; stage?: string; closeDate?: string; contactId?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<DealBody>(req);
  if (!body?.title || !body.contactId) return badRequest("title and contactId are required");

  // Only allow attaching a deal to a contact this user owns.
  const contact = await db.contact.findFirst({ where: { id: body.contactId, userId: gate.userId } });
  if (!contact) return notFound("Contact not found");

  const deal = await db.deal.create({
    data: {
      title:     body.title,
      value:     Number(body.value) || 0,
      stage:     body.stage || "prospect",
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      contactId: body.contactId,
    },
    include: { contact: { select: { id: true, name: true, company: true } } },
  });
  return NextResponse.json(deal, { status: 201 });
}
