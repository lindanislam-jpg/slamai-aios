import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await db.contact.findMany({
    where: { userId: session.user.id },
    include: { deals: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const contact = await db.contact.create({
    data: { ...data, userId: session.user.id },
  });
  return NextResponse.json(contact, { status: 201 });
}
