/** One-off import of the material traceability register during a hosted build,
 *  so company records never go into the repository.
 *    MATERIAL_IMPORT_GZ      base64 of gzip of a JSON array of
 *                            { project, description, grade, supplier, poRef, deliveryRef,
 *                              heatNumber, certificateRef, quantity, unit, source }
 *    MATERIAL_IMPORT_SHA256  sha256 of the uncompressed JSON; refuses to run if altered.
 *  Each entry is a transcription of a mill certificate, delivery docket or
 *  goods-in record. It is created through the audited material service as the
 *  first admin with the status "awaiting inspection" and its certificate as
 *  "uploaded, unverified": nothing is accepted or verified by the import. The
 *  source file is kept in the location field. An entry already imported (same
 *  project, description, heat number and delivery reference) is skipped. */
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { db } from "../src/lib/db";
import { createMaterial } from "../src/lib/services/materials";
import { actorFromUser } from "../src/lib/session";

interface Entry {
  project: string; description: string; grade?: string | null; supplier?: string | null; poRef?: string | null; deliveryRef?: string | null;
  heatNumber?: string | null; certificateRef?: string | null; quantity?: number | null; unit?: string | null; source: string;
}

const cut = (s: string | null | undefined, n: number) => (s ? String(s).trim().slice(0, n) || null : null);

async function main() {
  const gz = process.env.MATERIAL_IMPORT_GZ?.trim();
  if (!gz) return console.log("MATERIAL_IMPORT_GZ not set — no materials imported.");
  const raw = gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.MATERIAL_IMPORT_SHA256?.trim()) throw new Error(`Material payload checksum mismatch (got ${sha}). Nothing imported.`);
  const entries = JSON.parse(raw) as Entry[];
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  const tally = { created: 0, skipped: 0, failed: 0 };
  const projects = new Map<string, string | null>();
  for (const e of entries) {
    try {
      const code = e.project.toUpperCase();
      if (!projects.has(code)) projects.set(code, (await db.project.findUnique({ where: { code }, select: { id: true } }))?.id ?? null);
      const projectId = projects.get(code);
      if (!projectId) throw new Error("project not found");
      const description = e.description.trim().slice(0, 500);
      const heatNumber = cut(e.heatNumber, 120);
      const deliveryRef = cut(e.deliveryRef, 120);
      if (await db.material.findFirst({ where: { projectId, description, heatNumber, deliveryRef }, select: { id: true } })) {
        tally.skipped++;
        continue;
      }
      await createMaterial(actor, {
        projectId, description, heatNumber, deliveryRef,
        grade: cut(e.grade, 80), supplier: cut(e.supplier, 200), poRef: cut(e.poRef, 120), certificateRef: cut(e.certificateRef, 200),
        quantity: typeof e.quantity === "number" && Number.isFinite(e.quantity) ? e.quantity : null, unit: cut(e.unit, 20),
        location: cut(`Transcribed from SharePoint: ${e.source}`, 200),
      });
      tally.created++;
    } catch (err) {
      tally.failed++;
      console.log(`Material ${e.project} ${String(e.description).slice(0, 40)}: not imported —`, err instanceof Error ? err.message : err);
    }
  }
  console.log("Material import:", JSON.stringify(tally));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
