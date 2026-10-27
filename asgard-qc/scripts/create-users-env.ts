/** One-off user accounts during a hosted build, so staff names and emails
 *  never go into the repository.
 *    USER_CREATE  rows separated by "~", fields by "|": email|name|role|temporary password
 *  Existing emails are skipped, never changed. Runs as the first admin through
 *  the audited user service. Clear the variable after the deploy. */
import { Role } from "@prisma/client";
import { db } from "../src/lib/db";
import { createUser } from "../src/lib/services/users";
import { actorFromUser } from "../src/lib/session";

async function main() {
  const raw = process.env.USER_CREATE?.trim();
  if (!raw) return console.log("USER_CREATE not set — no users created.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  for (const line of raw.split("~")) {
    const [email, name, role, password] = line.split("|").map((s) => s.trim());
    if (!(role in Role)) throw new Error(`Unknown role "${role}" for ${email}.`);
    if (await db.user.findUnique({ where: { email: email.toLowerCase() } })) {
      console.log(`User ${email} already exists — skipped.`);
      continue;
    }
    await createUser(actor, { email, name, role: role as Role, password });
    console.log(`Created ${email} as ${role}.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
