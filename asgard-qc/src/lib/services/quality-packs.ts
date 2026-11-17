import type { PackStage, Prisma } from "@prisma/client";
import { z } from "zod";
import { recordEvent } from "../audit";
import { db } from "../db";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { assertCan, found, transaction } from "./base";

/**
 * Quality packs: the inspection / QC packs sent to the shop floor per
 * discipline (Issued) and the completed ones that came back (Returned).
 * Imported entries mirror the project's SharePoint folders, where the files
 * themselves stay; entries can also be recorded by hand.
 */

export const DISCIPLINES = ["Structural", "Architectural", "Mechanical", "Electrical", "Other"] as const;

/** "2. Structural Inspections" -> "Structural"; anything unrecognised is kept as written. */
export function disciplineName(folder: string): string {
  const s = folder.replace(/^\s*\d+\.?\s*/, "").replace(/\s*inspections?\s*$/i, "").trim();
  const hit = DISCIPLINES.find((d) => d.toLowerCase() === s.toLowerCase());
  return hit ?? (s || "Other");
}

export interface PackFilter { projectId?: string | null; stage?: PackStage | null; discipline?: string | null; q?: string | null }

export function packWhere(f: PackFilter): Prisma.QualityPackWhereInput {
  return {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.stage ? { stage: f.stage } : {}),
    ...(f.discipline ? { discipline: f.discipline } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { files: { has: f.q } }] } : {}),
  };
}

export async function listPacks(f: PackFilter, take = 1000) {
  return db.qualityPack.findMany({
    where: packWhere(f),
    orderBy: [{ returnedAt: { sort: "desc", nulls: "last" } }, { project: { code: "asc" } }, { discipline: "asc" }, { name: "asc" }],
    take,
    include: { project: { select: { id: true, code: true, name: true } } },
  });
}

/** Counts per project and discipline, for the register and the dashboard. */
export async function packCounts(f: PackFilter = {}) {
  const rows = await db.qualityPack.groupBy({ by: ["projectId", "discipline", "stage"], where: packWhere(f), _count: { _all: true } });
  const projects = await db.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId))] } }, select: { id: true, code: true, name: true } });
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out = new Map<string, { project: { id: string; code: string; name: string }; issued: number; returned: number; byDiscipline: Record<string, { issued: number; returned: number }> }>();
  for (const r of rows) {
    const p = byId.get(r.projectId);
    if (!p) continue;
    const e = out.get(p.id) ?? { project: p, issued: 0, returned: 0, byDiscipline: {} };
    const d = (e.byDiscipline[r.discipline] ??= { issued: 0, returned: 0 });
    if (r.stage === "RETURNED") { e.returned += r._count._all; d.returned += r._count._all; } else { e.issued += r._count._all; d.issued += r._count._all; }
    out.set(p.id, e);
  }
  return [...out.values()].sort((a, b) => b.returned - a.returned || a.project.code.localeCompare(b.project.code));
}

const packInput = z.object({
  projectId: z.string().min(1, "Choose a project."),
  discipline: z.string().trim().min(1, "Choose a discipline.").max(60),
  name: z.string().trim().min(1, "Name the pack (e.g. Skid No 4 paint QC pack).").max(200),
  stage: z.enum(["ISSUED", "RETURNED"]),
  date: z.coerce.date().optional().nullable(),
  returnedByName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** Record a pack by hand: issued to the floor, or already back. */
export async function recordPack(actor: Actor, raw: z.input<typeof packInput>) {
  assertCan(actor, "inspection.write");
  const d = packInput.parse(raw);
  return transaction(async (tx) => {
    found(await tx.project.findUnique({ where: { id: d.projectId }, select: { id: true } }), "Project");
    const code = await nextCode(tx, "QP", 4);
    const row = await tx.qualityPack.create({
      data: {
        code, projectId: d.projectId, discipline: d.discipline, name: d.name, stage: d.stage, kind: "record",
        issuedAt: d.stage === "ISSUED" ? d.date ?? new Date() : null,
        returnedAt: d.stage === "RETURNED" ? d.date ?? new Date() : null,
        returnedByName: d.stage === "RETURNED" ? d.returnedByName || null : null,
        notes: d.notes || null, createdByName: actor.name,
      },
    });
    await recordEvent(tx, actor, "quality_pack.record", "QualityPack", row.id, { summary: `${code} ${d.name} recorded as ${d.stage.toLowerCase()}`, after: d });
    return row;
  });
}

/** An issued pack has come back completed. */
export async function markPackReturned(actor: Actor, id: string, raw: { date?: string | Date | null; returnedByName?: string | null; notes?: string | null }) {
  assertCan(actor, "inspection.write");
  const d = z.object({ date: z.coerce.date().optional().nullable(), returnedByName: z.string().trim().max(120).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable() }).parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.qualityPack.findUnique({ where: { id } }), "Quality pack");
    if (before.stage === "RETURNED") throw new ValidationError(`${before.code} is already returned.`);
    const row = await tx.qualityPack.update({
      where: { id },
      data: { stage: "RETURNED", returnedAt: d.date ?? new Date(), returnedByName: d.returnedByName || null, notes: [before.notes, d.notes].filter(Boolean).join("\n") || null },
    });
    await recordEvent(tx, actor, "quality_pack.returned", "QualityPack", id, { summary: `${before.code} ${before.name} returned`, before: { stage: before.stage }, after: { stage: "RETURNED", returnedAt: row.returnedAt, returnedByName: row.returnedByName } });
    return row;
  });
}

export interface PackImportItem {
  project: string;
  discipline: string;
  stage: PackStage;
  name: string;
  kind: "file" | "folder";
  fileCount?: number | null;
  files?: string[];
  sourcePath: string;
  sourceUrl?: string | null;
}

/**
 * Mirror the SharePoint pack listing. One entry per item in an Issued or
 * Returned folder, keyed by project + SharePoint path, so a re-run only adds
 * new items and refreshes file lists; nothing is deleted. Dates are not
 * invented: a folder listing carries none, so returnedAt stays empty.
 */
export async function importPacks(actor: Actor, items: PackImportItem[]) {
  const tally = { created: 0, updated: 0, unchanged: 0, failed: 0, missingProjects: [] as string[] };
  const projects = new Map<string, string | null>();
  for (const it of items) {
    try {
      const code = it.project.toUpperCase();
      if (!projects.has(code)) projects.set(code, (await db.project.findUnique({ where: { code }, select: { id: true } }))?.id ?? null);
      const projectId = projects.get(code);
      if (!projectId) {
        if (!tally.missingProjects.includes(code)) tally.missingProjects.push(code);
        tally.failed++;
        continue;
      }
      const files = (it.files ?? []).slice(0, 300).map((f) => f.slice(0, 300));
      const existing = await db.qualityPack.findUnique({ where: { projectId_sourcePath: { projectId, sourcePath: it.sourcePath } } });
      if (existing) {
        if (existing.fileCount === (it.fileCount ?? null) && existing.files.join("\n") === files.join("\n")) { tally.unchanged++; continue; }
        await db.qualityPack.update({ where: { id: existing.id }, data: { fileCount: it.fileCount ?? null, files } });
        tally.updated++;
        continue;
      }
      await transaction(async (tx) => {
        const c = await nextCode(tx, "QP", 4);
        const row = await tx.qualityPack.create({
          data: {
            code: c, projectId, discipline: it.discipline.slice(0, 60), name: it.name.slice(0, 200), stage: it.stage, kind: it.kind,
            fileCount: it.fileCount ?? null, files, sourcePath: it.sourcePath.slice(0, 1000), sourceUrl: it.sourceUrl?.slice(0, 2000) ?? null,
            createdByName: "Imported from SharePoint",
          },
        });
        await recordEvent(tx, actor, "quality_pack.import", "QualityPack", row.id, { summary: `${c} ${it.name} (${it.stage.toLowerCase()}) imported from SharePoint` });
      });
      tally.created++;
    } catch (e) {
      tally.failed++;
      console.log(`Pack ${it.project} ${it.name}: not imported —`, e instanceof Error ? e.message : e);
    }
  }
  return tally;
}
