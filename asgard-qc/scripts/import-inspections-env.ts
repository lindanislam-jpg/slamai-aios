/** One-off import of historical inspection records during a hosted build, so
 *  company records never go into the repository.
 *    INSPECTION_IMPORT_GZ      base64 of gzip of a JSON array of
 *                              { project, records: [{ type, stage, componentRef, drawingRef,
 *                                inspectedAt, inspectorName, criteriaRef, result, comments,
 *                                source, items: [{ description, requirement, actual, result, notes }] }] }
 *    INSPECTION_IMPORT_SHA256  sha256 of the uncompressed JSON; refuses to run if altered.
 *  Each record is a transcription of a filled-in company record: it keeps the
 *  inspector name and date written on the original and names the source file in
 *  its comments. It goes through the audited inspection service as the first
 *  admin and is submitted for Quality Manager review when complete (never
 *  accepted). A record whose source is already imported for that project is skipped. */
import type { InspectionResult, InspectionType } from "@prisma/client";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { db } from "../src/lib/db";
import { createInspection, submissionProblems, submitInspection } from "../src/lib/services/inspections";
import { actorFromUser } from "../src/lib/session";

interface Item { description: string; requirement?: string | null; actual?: string | null; result?: InspectionResult; notes?: string | null }
interface Rec {
  type: InspectionType; stage?: string | null; componentRef?: string | null; drawingRef?: string | null;
  inspectedAt?: string | null; inspectorName?: string | null; criteriaRef?: string | null;
  result?: InspectionResult; comments?: string | null; source: string; items?: Item[];
}

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

async function main() {
  const gz = process.env.INSPECTION_IMPORT_GZ?.trim();
  if (!gz) return console.log("INSPECTION_IMPORT_GZ not set — no inspections imported.");
  const raw = gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.INSPECTION_IMPORT_SHA256?.trim()) throw new Error(`Inspection payload checksum mismatch (got ${sha}). Nothing imported.`);
  const projects = JSON.parse(raw) as { project: string; records: Rec[] }[];
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  for (const p of projects) {
    const project = await db.project.findUnique({ where: { code: p.project.toUpperCase() }, select: { id: true } });
    if (!project) {
      console.log(`${p.project}: project not found — skipped ${p.records.length} record(s).`);
      continue;
    }
    const tally = { created: 0, submitted: 0, draft: 0, skipped: 0, failed: 0 };
    for (const r of p.records) {
      const sourceNote = `Source: SharePoint ${r.source}`;
      if (await db.inspection.findFirst({ where: { projectId: project.id, comments: { contains: sourceNote } }, select: { id: true } })) {
        tally.skipped++;
        continue;
      }
      try {
        const comments = [
          `Historical record transcribed from the original company record; the original remains the controlling document.`,
          r.comments ?? "",
          sourceNote,
        ].filter(Boolean).join("\n");
        const insp = await createInspection(actor, {
          projectId: project.id,
          type: r.type,
          stage: cut(r.stage, 120),
          componentRef: cut(r.componentRef, 200),
          drawingRef: cut(r.drawingRef, 200),
          inspectedAt: r.inspectedAt ? new Date(`${r.inspectedAt}T12:00:00Z`) : null,
          inspectorName: cut(r.inspectorName, 200) ?? "Not stated on record",
          criteriaRef: cut(r.criteriaRef, 500),
          result: r.result ?? "PENDING",
          comments: comments.slice(0, 4000),
          items: (r.items ?? []).slice(0, 200).map((i) => ({
            description: i.description.slice(0, 500),
            requirement: cut(i.requirement, 1000),
            actual: cut(i.actual, 200),
            result: i.result ?? "PENDING",
            notes: cut(i.notes, 1000),
          })),
        });
        tally.created++;
        if (submissionProblems(insp).length === 0) {
          await submitInspection(actor, insp.id);
          tally.submitted++;
        } else tally.draft++;
      } catch (e) {
        tally.failed++;
        console.log(`${p.project}: could not import ${r.source}:`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`${p.project} inspections:`, JSON.stringify(tally));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
