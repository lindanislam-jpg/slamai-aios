"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { run, type ActionState } from "@/lib/action";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resetPassword } from "@/lib/services/users";
import { SESSION_COOKIE } from "@/lib/session";

export async function changeOwnPassword(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("password") ?? "");
    if (next !== String(fd.get("confirm") ?? "")) throw new ValidationError("The new passwords do not match.");
    const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new ValidationError("Current password is incorrect.");
    if (current === next) throw new ValidationError("Choose a different password.");
    await resetPassword(actor, actor.id, next);
    // All sessions were revoked; clear this browser's cookie too.
    (await cookies()).delete(SESSION_COOKIE);
    return { message: "Password changed. Sign in again.", redirect: "/login" };
  });
}
