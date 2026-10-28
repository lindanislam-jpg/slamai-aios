/** One-off NCR step during a hosted build, so company records never go into the
 *  repository.
 *    NCR_IMPORT_GZ      base64 of gzip of a JSON array of entries (below)
 *    NCR_IMPORT_SHA256  sha256 of the uncompressed JSON; refuses to run if altered.
 *  Two kinds of entry, both linked to the failed inspection they concern
 *  (found by the "Source: SharePoint <path>" line the inspection import wrote):
 *    mode "transcribe" — an NCR that already exists on paper (NCR / CAPA register).
 *      It is copied as recorded, keeping the paper number, dates and status; the
 *      paper register remains the controlling record. Nothing is decided here.
 *    mode "raise" — a failed inspection with no NCR found anywhere. A new NCR is
 *      raised (status Open) through the audited NCR service so the Quality
 *      Manager can investigate, disposition or cancel it.
 *  Runs as the first admin. An entry already applied (same paper number, or an
 *  NCR already linked to that inspection) is skipped, so a re-run changes nothing. */
import type { NcrStatus, Priority } from "@prisma/client";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { db } from "../src/lib/db";
import { recordEvent } from "../src/lib/audit";
import { nextCode } from "../src/lib/sequence";
import { raiseNcr } from "../src/lib/services/ncrs";
import { transaction } from "../src/lib/services/base";
import type { Actor } from "../src/lib/permissions";
import { actorFromUser } from "../src/lib/session";

export interface NcrImportEntry {
  project: string;
  mode: "transcribe" | "raise";
  inspectionSource?: string | null;
  paperRef?: string | null;
  register?: string | null;
  raisedAt?: string | null;
  raisedByName?: string | null;
  description: string;
  defectCategory: string;
  componentRef?: string | null;
  priority?: Priority;
  rootCause?: string | null;
  disposition?: string | null;
  status?: "OPEN" | "CLOSED";
  closedAt?: string | null;
  closedByName?: string | null;
}

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);
const day = (s: string | null | undefined) => (s ? new Date(`${s}T12:00:00Z`) : null);

async function main() {
  const gz = process.env.NCR_IMPORT_GZ?.trim();
  if (!gz) return console.log("NCR_IMPORT_GZ not set — no NCRs imported.");
  const raw = gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.NCR_IMPORT_SHA256?.trim()) throw new Error(`NCR payload checksum mismatch (got ${sha}). Nothing imported.`);
  const entries = JSON.parse(raw) as NcrImportEntry[];
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  console.log("NCR import:", JSON.stringify(await applyNcrImport(await actorFromUser(admin), entries)));
}

export async function applyNcrImport(actor: Actor, entries: NcrImportEntry[]) {
  const tally = { transcribed: 0, raised: 0, skipped: 0, failed: 0 };

  for (const e of entries) {
    const label = `${e.project} ${e.paperRef ?? e.inspectionSource ?? e.description.slice(0, 40)}`;
    try {
      const project = await db.project.findUnique({ where: { code: e.project.toUpperCase() }, select: { id: true } });
      if (!project) throw new Error("project not found");
      const insp = e.inspectionSource
        ? await db.inspection.findFirst({ where: { projectId: project.id, comments: { contains: `Source: SharePoint ${e.inspectionSource}` } }, select: { id: true, code: true, inspectedAt: true, stage: true, inspectorName: true, ncrs: { select: { id: true } } } })
        : null;
      if (e.inspectionSource && !insp) throw new Error("linked inspection not found");

      if (e.mode === "transcribe") {
        const paperRef = e.paperRef;
        if (!paperRef) throw new Error("transcribe entry needs paperRef");
        if (await db.ncr.findFirst({ where: { projectId: project.id, relatedCodes: { has: e.paperRef } }, select: { id: true } })) {
          tally.skipped++;
          continue;
        }
        const closed = e.status === "CLOSED";
        const description = [
          `Transcribed from ${e.register ?? "the company NCR register"} (${e.paperRef}); the paper record remains the controlling document.`,
          e.description,
        ].join("\n").slice(0, 4000);
        await transaction(async (tx) => {
          const code = await nextCode(tx, "NCR", 4);
          const status: NcrStatus = closed ? "CLOSED" : "OPEN";
          const ncr = await tx.ncr.create({
            data: {
              code, projectId: project.id, inspectionId: insp?.id ?? null,
              raisedAt: day(e.raisedAt) ?? insp?.inspectedAt ?? new Date(),
              raisedById: null, raisedByName: cut(e.raisedByName, 200) ?? "As per paper register",
              description, defectCategory: e.defectCategory.slice(0, 120), componentRef: cut(e.componentRef, 200),
              priority: e.priority ?? "MEDIUM", rootCause: cut(e.rootCause, 6000), disposition: cut(e.disposition, 1000),
              stageOfDetection: insp?.stage ?? null, detectedBy: insp?.inspectorName ?? null,
              relatedCodes: [paperRef.slice(0, 40)], status,
              closedAt: closed ? day(e.closedAt) : null,
              closedByName: closed ? cut(e.closedByName, 200) ?? "As per paper register" : null,
            },
          });
          await recordEvent(tx, actor, "ncr.transcribe", "Ncr", ncr.id, { summary: `${code} transcribed from ${e.paperRef} (${status})`, after: { ...e } });
        });
        tally.transcribed++;
      } else {
        if (!insp) throw new Error("raise entry needs a linked inspection");
        if (insp.ncrs.length) {
          tally.skipped++;
          continue;
        }
        const when = insp.inspectedAt?.toISOString().slice(0, 10) ?? "date not recorded";
        await raiseNcr(actor, {
          projectId: project.id,
          inspectionId: insp.id,
          componentRef: cut(e.componentRef, 200),
          defectCategory: e.defectCategory.slice(0, 120),
          priority: e.priority ?? "MEDIUM",
          stageOfDetection: insp.stage,
          detectedBy: insp.inspectorName,
          description: [
            `Raised retrospectively from historical inspection ${insp.code} (${when}), which recorded a failure and had no NCR in the company register. Quality Manager to confirm whether it was already resolved on the shop floor, then investigate and disposition, or cancel with a reason.`,
            e.description,
          ].join("\n").slice(0, 4000),
        });
        tally.raised++;
      }
    } catch (err) {
      tally.failed++;
      console.log(`NCR ${label}: not applied —`, err instanceof Error ? err.message : err);
    }
  }
  return tally;
}

if (process.argv[1]?.endsWith("import-ncrs-env.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
