/** One-off project register import during a hosted build.
 *  PROJECT_IMPORT_XLSX_B64 holds a base64 project-import workbook (same format
 *  as Project Register → Import). Existing projects and units are skipped, never
 *  changed. Keeps company data out of the repository. Runs as the first admin. */
import { db } from "../src/lib/db";
import { importProjects } from "../src/lib/import/projects";
import { actorFromUser } from "../src/lib/session";

async function main() {
  const b64 = process.env.PROJECT_IMPORT_XLSX_B64;
  if (!b64) return console.log("PROJECT_IMPORT_XLSX_B64 not set — no import.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const result = await importProjects(await actorFromUser(admin), Buffer.from(b64, "base64"), true);
  const count = (rows: { action: string }[]) => rows.reduce<Record<string, number>>((a, r) => ((a[r.action] = (a[r.action] ?? 0) + 1), a), {});
  console.log("Project import:", JSON.stringify({ projects: count(result.projects), units: count(result.units) }));
  if (result.errors.length) console.log("Errors:", JSON.stringify(result.errors));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
