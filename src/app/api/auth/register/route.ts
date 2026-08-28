import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api";

const schema = z.object({
  name:     z.string().trim().min(1, "All fields required"),
  email:    z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const { data, error } = await parseBody(req, schema);
    if (error) return error;

    // Stored lowercase so sign-in isn't case-sensitive on the email.
    const email = data.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await db.user.create({
      data: { name: data.name, email, password: hashed, plan: "free" },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
