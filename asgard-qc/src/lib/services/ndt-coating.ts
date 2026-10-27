import { InspectionResult, TestResult } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optDate, optId, optStr, reqDate, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";
import { refreshWeldStatus } from "./welding";

// ── NDT & test records ──

export const ndtInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  weldId: optId,
  method: reqStr(120),
  procedureRef: optStr(200),
  componentRef: optStr(200),
  requestedAt: reqDate,
  reportNo: optStr(120),
  reportDate: optDate,
  contractor: optStr(200),
  personnelRef: optStr(200),
  result: z.nativeEnum(TestResult).default("PENDING"),
  followUp: optStr(2000),
});

export async function saveNdt(actor: Actor, id: string | null, raw: z.input<typeof ndtInput>) {
  assertCan(actor, "ndt.write");
  const input = ndtInput.parse(raw);
  // A result is a claim from a report: no report number, no result.
  if (input.result !== "PENDING" && !input.reportNo) throw new ValidationError("Enter the NDT report number before recording a result.");
  return transaction(async (tx) => {
    if (input.weldId) {
      const w = found(await tx.weld.findUnique({ where: { id: input.weldId } }), "Weld");
      if (w.projectId !== input.projectId) throw new ValidationError("That weld belongs to a different project.");
    }
    let row;
    if (id) {
      const before = found(await tx.ndtRecord.findUnique({ where: { id } }), "NDT record");
      row = await tx.ndtRecord.update({ where: { id }, data: input });
      const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (d.changed) await recordEvent(tx, actor, "ndt.update", "NdtRecord", id, { summary: before.code, before: d.before, after: d.after });
      if (before.weldId && before.weldId !== input.weldId) await refreshWeldStatus(tx, before.weldId);
    } else {
      const code = await nextCode(tx, "NDT", 4);
      row = await tx.ndtRecord.create({ data: { ...input, code } });
      await recordEvent(tx, actor, "ndt.create", "NdtRecord", row.id, { summary: `${code} ${input.method}`, after: input });
    }
    if (row.weldId) await refreshWeldStatus(tx, row.weldId);
    return row;
  });
}

export async function listNdt(actor: Actor, f: { projectId?: string | null; outstanding?: boolean }) {
  assertCan(actor, "records.view");
  return db.ndtRecord.findMany({
    where: { ...(f.projectId ? { projectId: f.projectId } : {}), ...(f.outstanding ? { result: "PENDING" } : {}) },
    orderBy: { requestedAt: "desc" },
    take: 300,
    include: { project: { select: { code: true } }, unit: { select: { ref: true } }, weld: { select: { id: true, weldRef: true } } },
  });
}

// ── Painting & coating ──

export const coatingInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  surfacePrep: optStr(500),
  product: optStr(200),
  batchRef: optStr(120),
  envReadings: optStr(500),
  dftReadings: optStr(1000),
  specRef: optStr(300),
  result: z.nativeEnum(InspectionResult).default("PENDING"),
  inspectorName: optStr(200),
  inspectedAt: optDate,
  notes: optStr(2000),
});

export async function saveCoating(actor: Actor, id: string | null, raw: z.input<typeof coatingInput>) {
  assertCan(actor, "coating.write");
  const input = coatingInput.parse(raw);
  if ((input.result === "PASS" || input.result === "FAIL") && !input.specRef) {
    throw new ValidationError("Record the specification / acceptance reference used before recording a pass or fail.");
  }
  return transaction(async (tx) => {
    if (id) {
      const before = found(await tx.coatingRecord.findUnique({ where: { id } }), "Coating record");
      const row = await tx.coatingRecord.update({ where: { id }, data: input });
      const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (d.changed) await recordEvent(tx, actor, "coating.update", "CoatingRecord", id, { summary: before.code, before: d.before, after: d.after });
      return row;
    }
    const code = await nextCode(tx, "CT", 4);
    const row = await tx.coatingRecord.create({ data: { ...input, code, inspectorName: input.inspectorName ?? actor.name } });
    await recordEvent(tx, actor, "coating.create", "CoatingRecord", row.id, { summary: code, after: input });
    return row;
  });
}

export async function listCoatings(actor: Actor, f: { projectId?: string | null }) {
  assertCan(actor, "records.view");
  return db.coatingRecord.findMany({
    where: f.projectId ? { projectId: f.projectId } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { project: { select: { code: true } }, unit: { select: { ref: true } } },
  });
}
