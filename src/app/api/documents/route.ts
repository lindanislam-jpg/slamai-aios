import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const documents = await db.document.findMany({
    where: { userId: gate.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(documents);
}

type DocBody = { name?: string; type?: string; size?: number; url?: string; summary?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<DocBody>(req);
  if (!body?.name) return badRequest("name is required");

  const document = await db.document.create({
    data: {
      name:    body.name,
      type:    body.type || "unknown",
      size:    Number(body.size) || 0,
      url:     body.url || "",
      summary: body.summary,
      userId:  gate.userId,
    },
  });
  return NextResponse.json(document, { status: 201 });
}
