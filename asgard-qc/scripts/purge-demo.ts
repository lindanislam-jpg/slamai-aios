/** Remove all records flagged as demo data (isDemo = true).
 *    npm run db:purge-demo -- --yes
 *  Real records are never touched. Runs as the first active administrator. */
import { db } from "../src/lib/db";
import { actorFromUser } from "../src/lib/session";
import { purgeDemoData } from "../src/lib/services/settings";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes all DEMO records. Re-run with --yes to confirm.");
    process.exit(1);
  }
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true, NOT: { email: { endsWith: "@example.com" } } }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const result = await purgeDemoData(await actorFromUser(admin));
  console.log("Demo data purged:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
