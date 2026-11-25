/** One-off user accounts during a hosted build, so staff names and emails
 *  never go into the repository.
 *    USER_CREATE  rows separated by "~", fields by "|": email|name|role
 *  No passwords travel in the variable: each account gets a random password
 *  nobody knows, and an administrator sets the first one under Users → Reset
 *  password. Existing emails are skipped, never changed. Runs as the first
 *  admin through the audited user service. Clear the variable after the deploy.
 *    USER_ROLE_UPDATES  "email=ROLE,email=ROLE": change an existing user's role
 *                       (audited; their sessions are signed out). */
import { randomBytes } from "node:crypto";
import { Role } from "@prisma/client";
import { db } from "../src/lib/db";
import { recordEvent } from "../src/lib/audit";
import { transaction } from "../src/lib/services/base";
import { createUser, updateUser } from "../src/lib/services/users";
import { actorFromUser } from "../src/lib/session";

const CHECKER_EMAIL = "claude.checker@example.com";

async function main() {
  const raw = process.env.USER_CREATE?.trim();
  const roles = process.env.USER_ROLE_UPDATES?.trim();
  const checkerHash = process.env.CHECKER_PASSWORD_HASH?.trim();
  if (!raw && !roles && !checkerHash) return console.log("USER_CREATE / USER_ROLE_UPDATES / CHECKER_PASSWORD_HASH not set — no user changes.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  for (const line of raw ? raw.split("~") : []) {
    const [email, name, role] = line.split("|").map((s) => s.trim());
    if (!(role in Role)) throw new Error(`Unknown role "${role}" for ${email}.`);
    if (await db.user.findUnique({ where: { email: email.toLowerCase() } })) {
      console.log(`User ${email} already exists — skipped.`);
      continue;
    }
    await createUser(actor, { email, name, role: role as Role, password: randomBytes(32).toString("base64url") });
    console.log(`Created ${email} as ${role}.`);
  }
  // The read-only checker account's sign-in: only a bcrypt hash travels, and
  // only the Auditor-role checker account can be given one this way.
  if (checkerHash) {
    if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(checkerHash)) throw new Error("CHECKER_PASSWORD_HASH is not a bcrypt hash.");
    const checker = await db.user.findUnique({ where: { email: CHECKER_EMAIL } });
    if (!checker || checker.role !== "AUDITOR") throw new Error(`${CHECKER_EMAIL} must exist with the Auditor role.`);
    await transaction(async (tx) => {
      await tx.user.update({ where: { id: checker.id }, data: { passwordHash: checkerHash, active: true } });
      await recordEvent(tx, actor, "user.password", "User", checker.id, { summary: `Password set for ${CHECKER_EMAIL} (read-only checker)` });
    });
    console.log(`Password set for ${CHECKER_EMAIL}.`);
  }
  for (const pair of roles ? roles.split(",") : []) {
    const [email, role] = pair.split("=").map((s) => s.trim());
    if (!(role in Role)) throw new Error(`Unknown role "${role}" for ${email}.`);
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new Error(`No user ${email}.`);
    if (user.role === role) {
      console.log(`${email} is already ${role} — unchanged.`);
      continue;
    }
    await updateUser(actor, user.id, { role: role as Role });
    console.log(`${email}: ${user.role} → ${role}.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
