import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUserId, unauthorized } from "@/lib/api";
import { dealUpdateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Deal not found" }, { status: 404 });

/** A deal belongs to the user who owns its contact. */
const ownedBy = (id: string, userId: string) => ({ id, contact: { userId } });

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const { data, error } = await parseBody(req, dealUpdateSchema);
  if (error) return error;

  const existing = await db.deal.findFirst({ where: ownedBy(id, userId), select: { id: true } });
  if (!existing) return notFound();

  // Marking a deal won without a close date stamps it now, so it lands in the
  // right bucket on the revenue chart.
  const closingNow = data.stage === "won" && data.closeDate === undefined;

  const deal = await db.deal.update({
    where: { id },
    data: {
      ...data,
      ...(data.closeDate !== undefined
        ? { closeDate: data.closeDate ? new Date(data.closeDate) : null }
        : closingNow
          ? { closeDate: new Date() }
          : {}),
    },
  });
  return NextResponse.json(deal);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await db.deal.findFirst({ where: ownedBy(id, userId), select: { id: true } });
  if (!existing) return notFound();

  await db.deal.delete({ where: { id } });
  return NextResponse.json({ id });
}
