import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const websites = await db.website.findMany({
    where: { userId: gate.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(websites);
}

type WebsiteBody = { name?: string; template?: string; domain?: string; status?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<WebsiteBody>(req);
  if (!body?.name || !body.template) return badRequest("name and template are required");

  const website = await db.website.create({
    data: {
      name:     body.name,
      template: body.template,
      domain:   body.domain,
      status:   body.status || "draft",
      userId:   gate.userId,
    },
  });
  return NextResponse.json(website, { status: 201 });
}
