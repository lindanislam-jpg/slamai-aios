import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest, notFound } from "@/lib/api";

type InstallBody = { agentId?: string };

/** Installs a marketplace agent: records the install and creates a working AI agent from it. */
export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<InstallBody>(req);
  if (!body?.agentId) return badRequest("agentId is required");

  const listing = await db.marketplaceAgent.findUnique({ where: { id: body.agentId } });
  if (!listing) return notFound("Agent not found in the marketplace");

  const already = await db.agentInstall.findUnique({
    where: { userId_agentId: { userId: gate.userId, agentId: listing.id } },
  });
  if (already) return NextResponse.json({ ok: true, alreadyInstalled: true });

  await db.$transaction([
    db.agentInstall.create({ data: { userId: gate.userId, agentId: listing.id } }),
    db.marketplaceAgent.update({
      where: { id: listing.id },
      data: { installs: { increment: 1 } },
    }),
    db.aIAgent.create({
      data: {
        name:         listing.name,
        type:         listing.category.toLowerCase(),
        description:  listing.description,
        systemPrompt: `You are ${listing.name}. ${listing.description} Be helpful, professional and concise.`,
        userId:       gate.userId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Uninstalls a marketplace agent. The AI agent it created is left in place. */
export async function DELETE(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<InstallBody>(req);
  if (!body?.agentId) return badRequest("agentId is required");

  const install = await db.agentInstall.findUnique({
    where: { userId_agentId: { userId: gate.userId, agentId: body.agentId } },
  });
  if (!install) return notFound("Not installed");

  await db.$transaction([
    db.agentInstall.delete({ where: { id: install.id } }),
    db.marketplaceAgent.update({
      where: { id: body.agentId },
      data: { installs: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
