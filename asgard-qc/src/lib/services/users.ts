import { Role } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { hashPassword, MIN_PASSWORD_LENGTH, revokeUserSessions } from "../session";
import { assertCan, found, transaction } from "./base";

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200);

export const userInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.nativeEnum(Role),
  password: passwordSchema,
});

export async function listUsers(actor: Actor) {
  assertCan(actor, "users.manage");
  return db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true } });
}

export async function createUser(actor: Actor, raw: z.input<typeof userInput>) {
  assertCan(actor, "users.manage");
  const input = userInput.parse(raw);
  return transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) } });
    await recordEvent(tx, actor, "user.create", "User", user.id, { summary: `${input.email} as ${input.role}` });
    return { id: user.id };
  });
}

export async function updateUser(actor: Actor, id: string, raw: { role?: Role; active?: boolean; name?: string }) {
  assertCan(actor, "users.manage");
  return transaction(async (tx) => {
    const before = found(await tx.user.findUnique({ where: { id } }), "User");
    if (id === actor.id && (raw.active === false || (raw.role && raw.role !== "ADMIN"))) throw new ValidationError("You cannot demote or deactivate your own account.");
    if (before.role === "ADMIN" && ((raw.role && raw.role !== "ADMIN") || raw.active === false)) {
      const admins = await tx.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) throw new ValidationError("At least one active administrator is required.");
    }
    const user = await tx.user.update({ where: { id }, data: raw });
    await recordEvent(tx, actor, "user.update", "User", id, { summary: before.email, before: { role: before.role, active: before.active, name: before.name }, after: raw });
    if (raw.active === false || raw.role) await revokeUserSessions(id);
    return { id: user.id };
  });
}

export async function resetPassword(actor: Actor, id: string, password: string) {
  if (id !== actor.id) assertCan(actor, "users.manage");
  const pw = passwordSchema.parse(password);
  await transaction(async (tx) => {
    const u = found(await tx.user.findUnique({ where: { id } }), "User");
    await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw) } });
    await recordEvent(tx, actor, "user.password", "User", id, { summary: `Password changed for ${u.email}` });
  });
  await revokeUserSessions(id);
}
