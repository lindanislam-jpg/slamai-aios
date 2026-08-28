import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type CampaignPatch = { name?: string; status?: string; content?: string; platform?: string };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<CampaignPatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.campaign.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Campaign not found");

  const campaign = await db.campaign.update({
    where: { id },
    data: pick(body, ["name", "status", "content", "platform"]),
  });
  return NextResponse.json(campaign);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.campaign.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Campaign not found");

  await db.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
