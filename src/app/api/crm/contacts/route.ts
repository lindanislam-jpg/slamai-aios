import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest, pick } from "@/lib/api";

type ContactInput = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  stage?: string;
  score?: number;
  tags?: string;
  notes?: string;
};

/** The only columns a client may set, matching the PATCH handler. */
const WRITABLE = ["name", "email", "phone", "company", "stage", "score", "tags", "notes"] as const;

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const contacts = await db.contact.findMany({
    where: { userId: gate.userId },
    include: { deals: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<ContactInput>(req);
  if (!body) return badRequest("Invalid body");

  const name = body.name?.trim();
  if (!name) return badRequest("Name required");

  // Only the writable columns are passed through: spreading the raw body let a
  // client set id, timestamps, userId, or nested relation writes.
  const contact = await db.contact.create({
    data: { ...pick(body, WRITABLE), name, userId: gate.userId },
    include: { deals: true },
  });
  return NextResponse.json(contact, { status: 201 });
}
