/** One-off during a hosted build: when RAISE_NCRS_FOR_FAILS=true, raise an
 *  NCR for every inspection that recorded a problem and has none yet, as the
 *  first administrator (who asked for it). Re-running changes nothing. */
import { db } from "../src/lib/db";
import { raiseNcrsForFailedInspections } from "../src/lib/automation";
import { actorFromUser } from "../src/lib/session";

async function main() {
  if (process.env.RAISE_NCRS_FOR_FAILS !== "true") return console.log("RAISE_NCRS_FOR_FAILS not set — no NCRs raised.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const r = await raiseNcrsForFailedInspections(await actorFromUser(admin));
  console.log(`NCRs for failed inspections: checked ${r.checked}, raised ${r.raised.length}`);
  for (const x of r.raised) console.log(`  ${x.code} ← ${x.inspection} (${x.project})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
