import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { readJson, badRequest } from "@/lib/api";
import { consumeResetToken } from "@/lib/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/utils";

type Body = { token?: string; password?: string };

export async function POST(req: NextRequest) {
  const body = await readJson<Body>(req);
  if (!body?.token || !body.password) {
    return badRequest("A reset token and a new password are required");
  }
  if (body.password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const userId = await consumeResetToken(body.token);
  if (!userId) {
    return NextResponse.json(
      { error: "That reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(body.password, 12) },
  });

  return NextResponse.json({ ok: true });
}
