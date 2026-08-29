import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";
import { getPlan } from "@/lib/plans";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const user = await db.user.findUnique({
    where: { id: gate.userId },
    select: {
      id: true, name: true, email: true, company: true, role: true, plan: true,
      stripeStatus: true, planRenewsAt: true, stripeCustomerId: true, createdAt: true,
    },
  });
  if (!user) return badRequest("User not found");

  return NextResponse.json({
    ...user,
    hasBillingAccount: Boolean(user.stripeCustomerId),
    stripeCustomerId: undefined,
    planDetails: getPlan(user.plan),
  });
}

type ProfileBody = { name?: string; company?: string };

export async function PATCH(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<ProfileBody>(req);
  if (!body) return badRequest("Invalid body");
  if (body.name !== undefined && body.name.trim().length < 2) {
    return badRequest("Name must be at least 2 characters");
  }

  const user = await db.user.update({
    where: { id: gate.userId },
    data: {
      ...(body.name    !== undefined && { name: body.name.trim() }),
      ...(body.company !== undefined && { company: body.company.trim() || null }),
    },
    select: { id: true, name: true, email: true, company: true, plan: true },
  });

  return NextResponse.json(user);
}
