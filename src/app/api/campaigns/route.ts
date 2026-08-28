import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const campaigns = await db.campaign.findMany({
    where: { userId: gate.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

type CampaignBody = {
  name?: string;
  type?: string;
  status?: string;
  content?: string;
  platform?: string;
};

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<CampaignBody>(req);
  if (!body?.name || !body.type) return badRequest("name and type are required");

  const campaign = await db.campaign.create({
    data: {
      name:     body.name,
      type:     body.type,
      status:   body.status || "draft",
      content:  body.content,
      platform: body.platform,
      userId:   gate.userId,
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
