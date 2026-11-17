/** One-off import of the quality-pack listing during a hosted build, so
 *  company records never go into the repository.
 *    PACK_IMPORT_GZ (+ _GZ_2 … _GZ_9)  base64 of gzip of a JSON array of
 *        { project, discipline, stage: "ISSUED"|"RETURNED", name, kind: "file"|"folder",
 *          fileCount, files, sourcePath, sourceUrl }
 *    PACK_IMPORT_SHA256  sha256 of the uncompressed JSON; refuses to run if altered.
 *  Each entry mirrors one item in a project's SharePoint "In Process
 *  Inspections/<discipline>/1. Issued" or "2. Returned" folder. Keyed by
 *  project + SharePoint path, so a re-run adds only new items; nothing is
 *  deleted and no dates are invented. Runs as the first admin. */
import { db } from "../src/lib/db";
import { importPacks, type PackImportItem } from "../src/lib/services/quality-packs";
import { actorFromUser } from "../src/lib/session";
import { readPayload } from "./payload";

async function main() {
  const items = readPayload<PackImportItem[]>("PACK_IMPORT");
  if (!items) return console.log("PACK_IMPORT_GZ not set — no quality packs imported.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  console.log("Quality pack import:", JSON.stringify(await importPacks(await actorFromUser(admin), items)));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
