import { DefectSource, InspectionResult, type Prisma, type WeldStatus } from "@prisma/client";
import { z } from "zod";
import { db, type Tx } from "../db";
import { diff, recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { bool, optDate, optId, optNum, optStr, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";

export const weldInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  weldRef: reqStr(80),
  componentRef: optStr(200),
  drawingRef: optStr(200),
  wpsRef: optStr(120),
  welderId: optStr(120),
  welderQualRef: optStr(120),
  process: optStr(120),
  materialDetails: optStr(500),
  stage: optStr(120),
  criteriaRef: optStr(300),
  ndtRequired: bool.optional(),
  notes: optStr(4000),
});

export async function createWeld(actor: Actor, raw: z.input<typeof weldInput>) {
  assertCan(actor, "weld.write");
  const input = weldInput.parse(raw);
  return transaction(async (tx) => {
    if (input.unitId) {
      const u = found(await tx.unit.findUnique({ where: { id: input.unitId } }), "Module / frame");
      if (u.projectId !== input.projectId) throw new ValidationError("That frame belongs to a different project.");
    }
    const weld = await tx.weld.create({ data: input });
    await recordEvent(tx, actor, "weld.create", "Weld", weld.id, { summary: weld.weldRef, after: input });
    return weld;
  });
}

export async function updateWeld(actor: Actor, id: string, raw: Partial<z.input<typeof weldInput>>) {
  assertCan(actor, "weld.write");
  const input = weldInput.omit({ projectId: true }).partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.weld.findUnique({ where: { id } }), "Weld");
    const weld = await tx.weld.update({ where: { id }, data: input });
    const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "weld.update", "Weld", id, { summary: before.weldRef, before: d.before, after: d.after });
    if ("ndtRequired" in input) await refreshWeldStatus(tx, id);
    return weld;
  });
}

/**
 * Weld status is derived, never typed in:
 *  - visual FAIL                         → REPAIR_REQUIRED (or AWAITING_REINSPECTION once a repair is logged)
 *  - visual PASS, NDT required, any NDT pending/rejected/none → AWAITING_INSPECTION
 *  - visual PASS and NDT (if required) all accepted            → ACCEPTED
 */
export function deriveWeldStatus(w: {
  visualResult: InspectionResult;
  ndtRequired: boolean;
  ndtResults: ("PENDING" | "ACCEPT" | "REJECT")[];
  openRepairAwaitingReinspection: boolean;
}): WeldStatus {
  if (w.openRepairAwaitingReinspection) return "AWAITING_REINSPECTION";
  if (w.visualResult === "FAIL") return "REPAIR_REQUIRED";
  if (w.visualResult !== "PASS") return "AWAITING_INSPECTION";
  if (w.ndtRequired) {
    if (w.ndtResults.includes("REJECT")) return "REPAIR_REQUIRED";
    if (w.ndtResults.length === 0 || w.ndtResults.includes("PENDING")) return "AWAITING_INSPECTION";
  }
  return "ACCEPTED";
}

export async function refreshWeldStatus(tx: Tx, weldId: string) {
  const w = await tx.weld.findUniqueOrThrow({ where: { id: weldId }, include: { ndt: true, repairs: true } });
  const status = deriveWeldStatus({
    visualResult: w.visualResult,
    ndtRequired: w.ndtRequired,
    ndtResults: w.ndt.map((n) => n.result),
    openRepairAwaitingReinspection: w.repairs.some((r) => r.reinspectionResult === "PENDING"),
  });
  if (status !== w.status) await tx.weld.update({ where: { id: weldId }, data: { status } });
  return status;
}

export const visualInput = z.object({
  visualResult: z.nativeEnum(InspectionResult),
  inspectedAt: optDate,
  inspectorName: optStr(200),
  criteriaRef: optStr(300),
  notes: optStr(4000),
});

/** Record a visual inspection result. A pass after a repair is a re-inspection
 *  decision and needs the weld.confirm permission. */
export async function recordVisual(actor: Actor, weldId: string, raw: z.input<typeof visualInput>) {
  assertCan(actor, "weld.write");
  const input = visualInput.parse(raw);
  if (input.visualResult === "PENDING") throw new ValidationError("Choose a visual inspection result.");
  return transaction(async (tx) => {
    const weld = found(await tx.weld.findUnique({ where: { id: weldId }, include: { repairs: true } }), "Weld");
    const pendingRepair = weld.repairs.find((r) => r.reinspectionResult === "PENDING");
    if (pendingRepair) {
      assertCan(actor, "weld.confirm");
      await tx.repair.update({
        where: { id: pendingRepair.id },
        data: { reinspectionResult: input.visualResult, reinspectedBy: actor.name, reinspectedAt: input.inspectedAt ?? new Date() },
      });
    }
    await tx.weld.update({
      where: { id: weldId },
      data: {
        visualResult: input.visualResult,
        inspectedAt: input.inspectedAt ?? new Date(),
        inspectorName: input.inspectorName ?? actor.name,
        criteriaRef: input.criteriaRef ?? weld.criteriaRef,
        notes: input.notes ?? weld.notes,
      },
    });
    const status = await refreshWeldStatus(tx, weldId);
    await recordEvent(tx, actor, pendingRepair ? "weld.reinspect" : "weld.visual", "Weld", weldId, {
      summary: `${weld.weldRef} visual ${input.visualResult}${pendingRepair ? ` (re-inspection after ${pendingRepair.code})` : ""} → ${status}`,
      before: { visualResult: weld.visualResult, status: weld.status },
      after: { visualResult: input.visualResult, status },
    });
    return status;
  });
}

export async function addDefect(actor: Actor, weldId: string, raw: { category: string; notes?: string | null; source?: DefectSource }) {
  assertCan(actor, "weld.write");
  const category = reqStr(120).parse(raw.category);
  const source = raw.source ?? "INSPECTOR";
  return transaction(async (tx) => {
    const weld = found(await tx.weld.findUnique({ where: { id: weldId } }), "Weld");
    // An inspector with confirm rights recording a defect they saw confirms it;
    // AI suggestions always start unconfirmed.
    const confirm = source === "INSPECTOR" && actor.permissions.has("weld.confirm");
    const defect = await tx.weldDefect.create({
      data: {
        weldId,
        category,
        notes: raw.notes ?? null,
        source,
        recordedById: actor.id,
        confirmed: confirm,
        confirmedById: confirm ? actor.id : null,
        confirmedAt: confirm ? new Date() : null,
      },
    });
    await recordEvent(tx, actor, "weld.defect.add", "Weld", weldId, { summary: `${weld.weldRef}: ${category} (${confirm ? "confirmed" : "unconfirmed"}, ${source.toLowerCase()})` });
    return defect;
  });
}

export async function confirmDefect(actor: Actor, defectId: string, confirmed: boolean, note?: string) {
  assertCan(actor, "weld.confirm");
  return transaction(async (tx) => {
    const d = found(await tx.weldDefect.findUnique({ where: { id: defectId }, include: { weld: true } }), "Defect");
    if (confirmed) {
      await tx.weldDefect.update({ where: { id: defectId }, data: { confirmed: true, confirmedById: actor.id, confirmedAt: new Date(), notes: note ? [d.notes, note].filter(Boolean).join("\n") : d.notes } });
    } else {
      await tx.weldDefect.delete({ where: { id: defectId } });
    }
    await recordEvent(tx, actor, confirmed ? "weld.defect.confirm" : "weld.defect.dismiss", "Weld", d.weldId, {
      summary: `${d.weld.weldRef}: ${d.category} ${confirmed ? "confirmed" : "dismissed — not a defect"}${note ? ` (${note})` : ""}`,
      before: d,
    });
  });
}

export const repairInput = z.object({
  description: reqStr(2000),
  method: optStr(500),
  performedBy: optStr(200),
  performedAt: optDate,
  hours: optNum,
  cost: optNum,
  costIsEstimate: bool.optional(),
  ncrId: optId,
  notes: optStr(2000),
});

export async function recordWeldRepair(actor: Actor, weldId: string, raw: z.input<typeof repairInput>) {
  assertCan(actor, "rework.write");
  const input = repairInput.parse(raw);
  return transaction(async (tx) => {
    const weld = found(await tx.weld.findUnique({ where: { id: weldId } }), "Weld");
    const code = await nextCode(tx, "RW", 4);
    const repair = await tx.repair.create({
      data: { ...input, code, projectId: weld.projectId, unitId: weld.unitId, weldId, reinspectionResult: "PENDING" },
    });
    await tx.weld.update({ where: { id: weldId }, data: { visualResult: "PENDING" } });
    await refreshWeldStatus(tx, weldId);
    await recordEvent(tx, actor, "weld.repair", "Weld", weldId, { summary: `${weld.weldRef}: ${code} logged — awaiting re-inspection`, after: input });
    return repair;
  });
}

export interface WeldFilter {
  projectId?: string | null;
  unitId?: string | null;
  status?: WeldStatus | null;
  q?: string | null;
}

export async function listWelds(actor: Actor, f: WeldFilter) {
  assertCan(actor, "records.view");
  const where: Prisma.WeldWhereInput = {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.unitId ? { unitId: f.unitId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { weldRef: { contains: f.q, mode: "insensitive" } },
            { wpsRef: { contains: f.q, mode: "insensitive" } },
            { welderId: { contains: f.q, mode: "insensitive" } },
            { componentRef: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.weld.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
    include: {
      project: { select: { code: true } },
      unit: { select: { ref: true } },
      defects: { select: { category: true, confirmed: true } },
      _count: { select: { photos: true, repairs: true, ndt: true } },
    },
  });
}

export async function getWeld(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const weld = found(
    await db.weld.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, ref: true } },
        defects: { orderBy: { recordedAt: "asc" } },
        photos: { where: { deletedAt: null }, orderBy: [{ takenAt: "asc" }, { uploadedAt: "asc" }] },
        ndt: true,
        ncrs: { select: { id: true, code: true, status: true } },
        repairs: { orderBy: { createdAt: "asc" }, include: { photos: { where: { deletedAt: null } } } },
      },
    }),
    "Weld",
  );
  const history = await db.auditEvent.findMany({ where: { entityType: "Weld", entityId: id }, orderBy: { at: "desc" } });
  return { weld, history };
}

/** Defect analytics from confirmed defects only. */
export async function weldAnalytics(projectId?: string | null) {
  const defects = await db.weldDefect.findMany({
    where: { confirmed: true, weld: projectId ? { projectId } : {} },
    include: { weld: { select: { projectId: true, unitId: true, welderId: true, weldRef: true, project: { select: { code: true } }, unit: { select: { ref: true } } } } },
  });
  const pareto = countBy(defects, (d) => d.category);
  const byProject = countBy(defects, (d) => d.weld.project.code);
  const byUnit = countBy(defects, (d) => (d.weld.unit ? `${d.weld.project.code} / ${d.weld.unit.ref}` : `${d.weld.project.code} / —`));
  const byMonth = countBy(defects, (d) => d.recordedAt.toISOString().slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
  // Repeat defects: same category recurring for the same welder or frame.
  const repeatMap = new Map<string, number>();
  for (const d of defects) {
    for (const scope of [d.weld.welderId ? `Welder ${d.weld.welderId}` : null, d.weld.unit ? `Frame ${d.weld.project.code}/${d.weld.unit.ref}` : null]) {
      if (!scope) continue;
      const k = `${scope} — ${d.category}`;
      repeatMap.set(k, (repeatMap.get(k) ?? 0) + 1);
    }
  }
  const repeats = [...repeatMap.entries()].filter(([, n]) => n >= 2).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  const repairs = await db.repair.findMany({ where: { weldId: { not: null }, ...(projectId ? { projectId } : {}) }, select: { createdAt: true, reinspectionResult: true } });
  const repairTrend = countBy(repairs, (r) => r.createdAt.toISOString().slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
  return { total: defects.length, pareto, byProject, byUnit, byMonth, repeats, repairTrend };
}

export function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
