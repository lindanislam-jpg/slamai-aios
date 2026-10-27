import { ActionStatus, ActionType, InspectionResult, NcrStatus, Priority, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optDate, optId, optStr, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";

export const OPEN_NCR: NcrStatus[] = ["OPEN", "CONTAINED", "INVESTIGATING", "ACTION_IN_PROGRESS", "AWAITING_VERIFICATION"];

export const ncrInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  componentRef: optStr(200),
  description: reqStr(4000),
  defectCategory: reqStr(120),
  requirementRef: optStr(500),
  containment: optStr(2000),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  ownerName: optStr(200),
  targetDate: optDate,
  inspectionId: optId,
  weldId: optId,
  materialId: optId,
  relatedCodes: z.preprocess((v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v ?? []), z.array(z.string().max(40)).max(20)).optional(),
});

export async function raiseNcr(actor: Actor, raw: z.input<typeof ncrInput>) {
  assertCan(actor, "ncr.raise");
  const input = ncrInput.parse(raw);
  return transaction(async (tx) => {
    if (input.unitId) {
      const u = found(await tx.unit.findUnique({ where: { id: input.unitId } }), "Module / frame");
      if (u.projectId !== input.projectId) throw new ValidationError("That frame belongs to a different project.");
    }
    const code = await nextCode(tx, "NCR", 4);
    const ncr = await tx.ncr.create({
      data: { ...input, relatedCodes: input.relatedCodes ?? [], code, raisedById: actor.id, raisedByName: actor.name, status: input.containment ? "CONTAINED" : "OPEN" },
    });
    await recordEvent(tx, actor, "ncr.raise", "Ncr", ncr.id, { summary: `${code} ${input.defectCategory} (${input.priority})`, after: input });
    return ncr;
  });
}

export const investigationInput = z.object({
  containment: optStr(2000),
  rootCauseCategory: optStr(120),
  rootCauseMethod: optStr(120),
  rootCause: optStr(6000),
  disposition: optStr(1000),
  repairMethod: optStr(2000),
  ownerName: optStr(200),
  targetDate: optDate,
  priority: z.nativeEnum(Priority).optional(),
  description: optStr(4000),
  requirementRef: optStr(500),
  relatedCodes: ncrInput.shape.relatedCodes,
});

export async function updateNcr(actor: Actor, id: string, raw: z.input<typeof investigationInput>) {
  assertCan(actor, "ncr.manage");
  const input = investigationInput.parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.ncr.findUnique({ where: { id } }), "NCR");
    if (!OPEN_NCR.includes(before.status)) throw new ValidationError(`${before.code} is ${before.status.toLowerCase()} — reopen it to make changes.`);
    const data: Prisma.NcrUncheckedUpdateInput = { ...input, description: input.description ?? before.description };
    const row = await tx.ncr.update({ where: { id }, data });
    const d = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "ncr.update", "Ncr", id, { summary: before.code, before: d.before, after: d.after });
    return row;
  });
}

/** Allowed manual status moves. Closing has its own function with checks. */
const TRANSITIONS: Record<NcrStatus, NcrStatus[]> = {
  OPEN: ["CONTAINED", "INVESTIGATING", "CANCELLED"],
  CONTAINED: ["INVESTIGATING", "ACTION_IN_PROGRESS", "CANCELLED"],
  INVESTIGATING: ["ACTION_IN_PROGRESS", "CANCELLED"],
  ACTION_IN_PROGRESS: ["AWAITING_VERIFICATION", "INVESTIGATING"],
  AWAITING_VERIFICATION: ["ACTION_IN_PROGRESS"],
  CLOSED: ["ACTION_IN_PROGRESS"],
  CANCELLED: ["OPEN"],
};

export function allowedTransitions(status: NcrStatus) {
  return TRANSITIONS[status];
}

export async function moveNcr(actor: Actor, id: string, to: NcrStatus, note?: string | null) {
  return transaction(async (tx) => {
    const n = found(await tx.ncr.findUnique({ where: { id }, include: { actions: true } }), "NCR");
    if (!TRANSITIONS[n.status].includes(to)) throw new ValidationError(`Cannot move ${n.code} from ${n.status} to ${to}.`);
    // Reopening a closed NCR or cancelling one is a closure-level decision.
    assertCan(actor, n.status === "CLOSED" || to === "CANCELLED" ? "ncr.close" : "ncr.manage");
    if ((to === "CANCELLED" || n.status === "CLOSED") && !note) throw new ValidationError("A reason is required.");
    if (to === "ACTION_IN_PROGRESS" && !n.rootCause && n.status !== "CLOSED") throw new ValidationError("Record the root cause before starting corrective action.");
    if (to === "AWAITING_VERIFICATION") {
      const open = n.actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");
      if (open.length) throw new ValidationError(`${open.length} corrective action(s) are still open.`);
      if (n.actions.filter((a) => a.status !== "CANCELLED").length === 0 && !n.disposition) {
        throw new ValidationError("Record a corrective action or an approved disposition first.");
      }
    }
    const row = await tx.ncr.update({ where: { id }, data: { status: to, ...(n.status === "CLOSED" ? { closedAt: null, closedById: null, closedByName: null } : {}) } });
    await recordEvent(tx, actor, "ncr.status", "Ncr", id, { summary: `${n.code}: ${n.status} → ${to}${note ? ` (${note})` : ""}`, before: { status: n.status }, after: { status: to } });
    return row;
  });
}

export const closureInput = z.object({
  verificationNotes: reqStr(4000),
  reinspectionResult: z.nativeEnum(InspectionResult),
});

/** Problems that block closure. Pure so the UI can show them before trying. */
export function closureProblems(n: {
  status: NcrStatus;
  rootCause: string | null;
  disposition: string | null;
  actions: { status: ActionStatus }[];
  reinspectionResult?: InspectionResult | null;
  verificationNotes?: string | null;
}) {
  const p: string[] = [];
  if (n.status !== "AWAITING_VERIFICATION") p.push("NCR must be in Awaiting verification.");
  if (!n.rootCause) p.push("Root cause not recorded.");
  const live = n.actions.filter((a) => a.status !== "CANCELLED");
  if (live.length === 0 && !n.disposition) p.push("No corrective action or disposition recorded.");
  if (live.some((a) => a.status !== "VERIFIED")) p.push("All corrective actions must be verified.");
  if (!n.verificationNotes) p.push("Verification evidence/notes required.");
  if (n.reinspectionResult !== "PASS" && n.reinspectionResult !== "NA") p.push("Re-inspection must pass (or be recorded as not applicable).");
  return p;
}

/** Close an NCR. Requires ncr.close, a verified fix and an explicit
 *  re-inspection result — a repair photo alone never closes anything. */
export async function closeNcr(actor: Actor, id: string, raw: z.input<typeof closureInput>) {
  assertCan(actor, "ncr.close");
  const input = closureInput.parse(raw);
  return transaction(async (tx) => {
    const n = found(await tx.ncr.findUnique({ where: { id }, include: { actions: true } }), "NCR");
    const problems = closureProblems({ ...n, ...input });
    if (problems.length) throw new ValidationError(`Cannot close ${n.code}: ${problems.join(" ")}`);
    const now = new Date();
    const row = await tx.ncr.update({
      where: { id },
      data: { ...input, status: "CLOSED", verifiedById: actor.id, verifiedAt: now, closedById: actor.id, closedByName: actor.name, closedAt: now },
    });
    await recordEvent(tx, actor, "ncr.close", "Ncr", id, { summary: `${n.code} closed by ${actor.name}`, after: input });
    return row;
  });
}

// ── Corrective / preventive actions ──

export const actionInput = z.object({
  ncrId: optId,
  auditFindingId: optId,
  type: z.nativeEnum(ActionType).default("CORRECTIVE"),
  description: reqStr(2000),
  ownerName: optStr(200),
  dueDate: optDate,
  notes: optStr(2000),
});

export async function addAction(actor: Actor, raw: z.input<typeof actionInput>) {
  const input = actionInput.parse(raw);
  if (!input.ncrId && !input.auditFindingId) throw new ValidationError("An action must belong to an NCR or an audit finding.");
  assertCan(actor, input.ncrId ? "ncr.manage" : "audit.write");
  return transaction(async (tx) => {
    const code = await nextCode(tx, "CA", 4);
    const row = await tx.correctiveAction.create({ data: { ...input, code } });
    await recordEvent(tx, actor, "action.create", "CorrectiveAction", row.id, { summary: `${code} ${input.type}`, after: input });
    return row;
  });
}

export async function updateActionStatus(actor: Actor, id: string, status: ActionStatus, notes?: string | null) {
  return transaction(async (tx) => {
    const a = found(await tx.correctiveAction.findUnique({ where: { id } }), "Action");
    assertCan(actor, a.ncrId ? "ncr.manage" : "audit.write");
    if (status === "VERIFIED") {
      assertCan(actor, a.ncrId ? "ncr.close" : "audit.write");
      if (a.status !== "COMPLETED") throw new ValidationError("Only completed actions can be verified.");
    }
    const row = await tx.correctiveAction.update({
      where: { id },
      data: {
        status,
        notes: notes ? [a.notes, `${actor.name}: ${notes}`].filter(Boolean).join("\n") : a.notes,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(status === "VERIFIED" ? { verifiedById: actor.id, verifiedAt: new Date() } : {}),
      },
    });
    await recordEvent(tx, actor, "action.status", "CorrectiveAction", id, { summary: `${a.code}: ${a.status} → ${status}`, before: { status: a.status }, after: { status } });
    return row;
  });
}

export interface NcrFilter {
  projectId?: string | null;
  status?: NcrStatus | "OPEN_ALL" | null;
  priority?: Priority | null;
  category?: string | null;
  q?: string | null;
  overdue?: boolean;
}

export async function listNcrs(actor: Actor, f: NcrFilter) {
  assertCan(actor, "records.view");
  const where: Prisma.NcrWhereInput = {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.status === "OPEN_ALL" ? { status: { in: OPEN_NCR } } : f.status ? { status: f.status } : {}),
    ...(f.priority ? { priority: f.priority } : {}),
    ...(f.category ? { defectCategory: f.category } : {}),
    ...(f.overdue ? { status: { in: OPEN_NCR }, targetDate: { lt: new Date() } } : {}),
    ...(f.q
      ? {
          OR: [
            { code: { contains: f.q, mode: "insensitive" } },
            { description: { contains: f.q, mode: "insensitive" } },
            { componentRef: { contains: f.q, mode: "insensitive" } },
            { unit: { ref: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  return db.ncr.findMany({
    where,
    orderBy: [{ raisedAt: "desc" }],
    take: 300,
    include: { project: { select: { code: true } }, unit: { select: { ref: true } }, actions: { select: { status: true } }, _count: { select: { photos: true } } },
  });
}

export async function getNcr(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const ncr = found(
    await db.ncr.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, ref: true } },
        inspection: { select: { id: true, code: true, result: true } },
        weld: { select: { id: true, weldRef: true, status: true } },
        material: { select: { id: true, code: true, heatNumber: true } },
        actions: { orderBy: { createdAt: "asc" } },
        photos: { where: { deletedAt: null }, orderBy: [{ takenAt: "asc" }, { uploadedAt: "asc" }] },
        repairs: { include: { photos: { where: { deletedAt: null } } } },
      },
    }),
    "NCR",
  );
  const [history, related] = await Promise.all([
    db.auditEvent.findMany({ where: { entityType: "Ncr", entityId: id }, orderBy: { at: "desc" } }),
    // Recurring issues: same category on the same project or frame.
    db.ncr.findMany({
      where: { id: { not: id }, defectCategory: ncr.defectCategory, OR: [{ projectId: ncr.projectId }, ...(ncr.unitId ? [{ unitId: ncr.unitId }] : []), { code: { in: ncr.relatedCodes } }] },
      select: { id: true, code: true, status: true, raisedAt: true, project: { select: { code: true } } },
      take: 20,
      orderBy: { raisedAt: "desc" },
    }),
  ]);
  return { ncr, history, related };
}

// ── Rework / repairs not tied to a weld ──

export const reworkInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  ncrId: optId,
  description: reqStr(2000),
  method: optStr(500),
  performedBy: optStr(200),
  performedAt: optDate,
  hours: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable().optional()),
  cost: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable().optional()),
  costIsEstimate: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).optional(),
  notes: optStr(2000),
});

export async function recordRework(actor: Actor, raw: z.input<typeof reworkInput>) {
  assertCan(actor, "rework.write");
  const input = reworkInput.parse(raw);
  return transaction(async (tx) => {
    const code = await nextCode(tx, "RW", 4);
    const row = await tx.repair.create({ data: { ...input, code } });
    await recordEvent(tx, actor, "rework.create", "Repair", row.id, { summary: `${code} ${input.description.slice(0, 80)}`, after: input });
    return row;
  });
}

export async function reinspectRework(actor: Actor, id: string, result: InspectionResult, notes?: string | null) {
  assertCan(actor, "inspection.write");
  return transaction(async (tx) => {
    const r = found(await tx.repair.findUnique({ where: { id } }), "Repair");
    if (r.weldId) throw new ValidationError("Weld repairs are re-inspected from the weld record.");
    const row = await tx.repair.update({ where: { id }, data: { reinspectionResult: result, reinspectedBy: actor.name, reinspectedAt: new Date(), notes: notes ? [r.notes, notes].filter(Boolean).join("\n") : r.notes } });
    await recordEvent(tx, actor, "rework.reinspect", "Repair", id, { summary: `${r.code} re-inspection ${result}` });
    return row;
  });
}

export async function listRework(actor: Actor, f: { projectId?: string | null; pendingOnly?: boolean }) {
  assertCan(actor, "records.view");
  return db.repair.findMany({
    where: { ...(f.projectId ? { projectId: f.projectId } : {}), ...(f.pendingOnly ? { reinspectionResult: "PENDING" } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      project: { select: { code: true } },
      unit: { select: { ref: true } },
      ncr: { select: { id: true, code: true } },
      weld: { select: { id: true, weldRef: true } },
      photos: { where: { deletedAt: null }, select: { id: true, reworkPhase: true, thumbKey: true, code: true } },
    },
  });
}
