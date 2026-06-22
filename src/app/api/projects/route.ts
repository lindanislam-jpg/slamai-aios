import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    include: { tasks: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const project = await db.project.create({
    data: { name, description, userId: session.user.id },
  });
  return NextResponse.json(project, { status: 201 });
}
