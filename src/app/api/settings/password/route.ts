import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

type PasswordBody = { currentPassword?: string; newPassword?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<PasswordBody>(req);
  if (!body?.currentPassword || !body.newPassword) {
    return badRequest("Both the current and new password are required");
  }
  if (body.newPassword.length < 12) {
    return badRequest("New password must be at least 12 characters");
  }
  if (body.newPassword === body.currentPassword) {
    return badRequest("The new password must be different from the current one");
  }

  const user = await db.user.findUnique({ where: { id: gate.userId } });
  if (!user?.password) return badRequest("This account has no password set");

  const valid = await bcrypt.compare(body.currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  await db.user.update({
    where: { id: user.id },
    data:  { password: await bcrypt.hash(body.newPassword, 12) },
  });

  return NextResponse.json({ ok: true });
}
