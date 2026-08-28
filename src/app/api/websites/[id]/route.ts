import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, notFound, pick } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
type WebsitePatch = { name?: string; domain?: string; status?: string };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson<WebsitePatch>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await db.website.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Website not found");

  const website = await db.website.update({
    where: { id },
    data: pick(body, ["name", "domain", "status"]),
  });
  return NextResponse.json(website);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const existing = await db.website.findFirst({ where: { id, userId: gate.userId } });
  if (!existing) return notFound("Website not found");

  await db.website.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
