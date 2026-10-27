/** One-off project register import during a hosted build, so company project
 *  lists never go into the repository.
 *    PROJECT_IMPORT_JSON   {projectHeader, projects, unitHeader, units, defaultDescription?}
 *                          — rows in the same columns as Project Register → Import.
 *    PROJECT_IMPORT_SHA256 sha256 of PROJECT_IMPORT_JSON; the import refuses to run
 *                          if the payload was altered or truncated in transit.
 *  Existing projects and units are skipped, never changed. Runs as the first admin. */
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import { importProjects } from "../src/lib/import/projects";
import { actorFromUser } from "../src/lib/session";

interface Payload {
  projectHeader: string[];
  projects: string[][];
  unitHeader: string[];
  units: string[][];
  defaultDescription?: string;
}

async function toWorkbook(p: Payload) {
  const wb = new ExcelJS.Workbook();
  const ps = wb.addWorksheet("Projects");
  ps.addRow(p.projectHeader);
  const di = p.projectHeader.indexOf("Description");
  for (const r of p.projects) {
    const row = [...r];
    if (p.defaultDescription && di >= 0 && !row[di]) row[di] = p.defaultDescription;
    ps.addRow(row.map((v) => (v === "" ? null : v)));
  }
  const us = wb.addWorksheet("Units");
  us.addRow(p.unitHeader);
  for (const r of p.units) us.addRow(r.map((v) => (v === "" ? null : v)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function main() {
  const raw = process.env.PROJECT_IMPORT_JSON;
  if (!raw) return console.log("PROJECT_IMPORT_JSON not set — no import.");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.PROJECT_IMPORT_SHA256) throw new Error(`Import payload checksum mismatch (got ${sha}). Nothing imported.`);
  const payload = JSON.parse(raw) as Payload;
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const result = await importProjects(await actorFromUser(admin), await toWorkbook(payload), true);
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
