import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, password: hashed, plan: "free" },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
