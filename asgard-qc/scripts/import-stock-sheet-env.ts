/** One-off import of the stores steel stock sheet during a hosted build, so
 *  company records never go into the repository.
 *    STOCK_SHEET_GZ (+ _GZ_2 …)  base64 of gzip of a JSON array of
 *        { sheetId, description, grade, heatNumber, poRef, quantity, unit, location, note, linkCertHeat }
 *    STOCK_SHEET_SHA256          sha256 of the uncompressed JSON; refuses to run if altered.
 *  Each row is a stores item (no project). It is matched, in order, to:
 *    1. the item already imported for the same sheet ID (re-runs only refresh it);
 *    2. a heat certificate already transcribed from "Steel Stock/Heat Certs" with
 *       the same heat number (linkCertHeat) and not yet linked to a sheet row —
 *       that record is completed with the sheet's location and quantities, keeping
 *       its certificate reference;
 *    3. otherwise a new material record is created.
 *  Prices are never part of the payload. Updates go through the audited
 *  material service; nothing is accepted, verified or deleted. */
import { db } from "../src/lib/db";
import { createMaterial, updateMaterial } from "../src/lib/services/materials";
import { actorFromUser } from "../src/lib/session";
import { readPayload } from "./payload";

interface Row {
  sheetId: string; description: string; grade?: string | null; heatNumber?: string | null; poRef?: string | null;
  quantity?: number | null; unit?: string | null; location: string; note?: string | null; linkCertHeat?: string | null;
}

const CERT_PREFIX = "Transcribed from SharePoint: 8.0 - Stores Materials/Steel Stock/Heat Certs";
const ref = (r: Row) => `Stock ID ${r.sheetId}${r.note ? ` — ${r.note}` : ""}`.slice(0, 200);

async function main() {
  const rows = readPayload<Row[]>("STOCK_SHEET");
  if (!rows) return console.log("STOCK_SHEET_GZ not set — stock sheet not imported.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  const tally = { refreshed: 0, linkedToCert: 0, created: 0, failed: 0 };
  for (const r of rows) {
    try {
      const fields = {
        componentRef: ref(r), description: r.description.slice(0, 500), location: r.location.slice(0, 200),
        quantity: typeof r.quantity === "number" ? r.quantity : null, unit: r.unit ?? null, poRef: r.poRef ?? null,
      };
      const mine = await db.material.findFirst({ where: { projectId: null, componentRef: { startsWith: `Stock ID ${r.sheetId}` } }, select: { id: true, componentRef: true } });
      if (mine && (mine.componentRef === `Stock ID ${r.sheetId}` || mine.componentRef?.startsWith(`Stock ID ${r.sheetId} `))) {
        await updateMaterial(actor, mine.id, { ...fields, heatNumber: r.heatNumber ?? null, grade: r.grade ?? null });
        tally.refreshed++;
        continue;
      }
      if (r.linkCertHeat) {
        const cert = await db.material.findFirst({
          where: { projectId: null, componentRef: null, location: { startsWith: CERT_PREFIX }, heatNumber: { contains: r.linkCertHeat } },
          select: { id: true, grade: true },
        });
        if (cert) {
          // The certificate's own heat number and grade stay; the sheet adds where and how much.
          await updateMaterial(actor, cert.id, { ...fields, grade: cert.grade ?? r.grade ?? null });
          tally.linkedToCert++;
          continue;
        }
      }
      await createMaterial(actor, { ...fields, heatNumber: r.heatNumber ?? null, grade: r.grade ?? null });
      tally.created++;
    } catch (err) {
      tally.failed++;
      console.log(`Stock row ${r.sheetId}: not imported —`, err instanceof Error ? err.message : err);
    }
  }
  console.log("Stock sheet import:", JSON.stringify(tally));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
