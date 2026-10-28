import { createHash, randomUUID } from "node:crypto";
import { CmrStatus, Priority, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import { ForbiddenError, ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { storage } from "../storage";
import { bool, optDate, optId, optNum, optStr, reqStr } from "../validation";
import { OPEN_CMR } from "./alert-rules";
import { assertCan, found, transaction } from "./base";

/**
 * Corrective Maintenance Requests. A CMR records an equipment problem, the
 * maintenance work done and the authorised verification that the equipment
 * can return to service. The system never declares equipment safe or
 * calibrated; it records who verified it and when.
 */

export { OPEN_CMR };

export const cmrInput = z.object({
  equipmentId: optId,
  assetLabel: optStr(200),
  location: optStr(200),
  projectId: optId,
  productionArea: optStr(200),
  problem: reqStr(4000),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  safetyImpact: bool.optional(),
  productionImpact: optStr(1000),
  equipmentUnavailable: bool.optional(),
  requestedBy: optDate,
});

export async function raiseCmr(actor: Actor, raw: z.input<typeof cmrInput>) {
  assertCan(actor, "cmr.raise");
  const input = cmrInput.parse(raw);
  if (!input.equipmentId && !input.assetLabel) throw new ValidationError("Choose the equipment, or name it if it is not in the register.");
  return transaction(async (tx) => {
    const eq = input.equipmentId ? found(await tx.equipment.findUnique({ where: { id: input.equipmentId } }), "Equipment") : null;
    const code = await nextCode(tx, "CMR", 4);
    const row = await tx.cmr.create({
      data: { ...input, safetyImpact: input.safetyImpact ?? false, equipmentUnavailable: input.equipmentUnavailable ?? false, location: input.location ?? eq?.location ?? null, code, reportedById: actor.id, reportedByName: actor.name },
    });
    if (eq && input.equipmentUnavailable && eq.status !== "OUT_OF_SERVICE") {
      // Reporting a fact (the asset is unavailable), not a safety decision.
      await tx.equipment.update({ where: { id: eq.id }, data: { status: "OUT_OF_SERVICE", statusNote: `Unavailable — ${code}` } });
      await recordEvent(tx, actor, "equipment.status", "Equipment", eq.id, { summary: `${eq.assetNo} out of service (${code})`, before: { status: eq.status }, after: { status: "OUT_OF_SERVICE" } });
    }
    await recordEvent(tx, actor, "cmr.raise", "Cmr", row.id, { summary: `${code} ${input.priority} — ${eq ? eq.assetNo : input.assetLabel}`, after: input });
    return row;
  });
}

export const cmrWorkInput = z.object({
  assignedToName: optStr(200),
  diagnosis: optStr(4000),
  workDone: optStr(4000),
  partsUsed: optStr(2000),
  startedAt: optDate,
  completedAt: optDate,
  downtimeHours: optNum,
  outstandingIssues: optStr(2000),
  productionImpact: optStr(1000),
  requestedBy: optDate,
  priority: z.nativeEnum(Priority).optional(),
});

/** Maintenance work log. Locked once the CMR is closed or cancelled. */
export async function updateCmrWork(actor: Actor, id: string, raw: z.input<typeof cmrWorkInput>) {
  assertCan(actor, "cmr.work");
  const input = cmrWorkInput.parse(raw);
  if (input.downtimeHours != null && (input.downtimeHours < 0 || input.downtimeHours > 100_000)) throw new ValidationError("Downtime hours must be zero or more.");
  return transaction(async (tx) => {
    const before = found(await tx.cmr.findUnique({ where: { id } }), "CMR");
    if (before.status === "CLOSED" || before.status === "CANCELLED") throw new ValidationError(`${before.code} is ${before.status.toLowerCase()}; reopen it to record more work.`);
    if (input.startedAt && input.completedAt && input.completedAt < input.startedAt) throw new ValidationError("Completion cannot be before the start.");
    const data = Object.fromEntries(Object.entries(input).filter(([k]) => k in raw)) as Prisma.CmrUpdateInput;
    const row = await tx.cmr.update({ where: { id }, data });
    const d = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    await recordEvent(tx, actor, "cmr.work", "Cmr", id, { summary: `${before.code} work log updated`, ...d });
    return row;
  });
}

const FLOW: Partial<Record<CmrStatus, CmrStatus[]>> = {
  SUBMITTED: ["ACKNOWLEDGED", "ASSIGNED", "CANCELLED"],
  ACKNOWLEDGED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_PARTS", "AWAITING_EXTERNAL", "AWAITING_VERIFICATION", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_EXTERNAL: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_VERIFICATION: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: ["CLOSED"],
};
export const cmrTransitions = (s: CmrStatus) => FLOW[s] ?? [];

export const cmrMoveInput = z.object({
  status: z.nativeEnum(CmrStatus),
  assignedToName: optStr(200),
  note: optStr(2000),
  returnToService: bool.optional(),
});

export async function moveCmr(actor: Actor, id: string, raw: z.input<typeof cmrMoveInput>) {
  const input = cmrMoveInput.parse(raw);
  const to = input.status;
  assertCan(actor, to === "COMPLETED" || to === "CLOSED" ? "cmr.verify" : "cmr.work");
  return transaction(async (tx) => {
    const c = found(await tx.cmr.findUnique({ where: { id }, include: { equipment: true } }), "CMR");
    if (!cmrTransitions(c.status).includes(to)) throw new ValidationError(`${c.code} cannot move from ${c.status.toLowerCase()} to ${to.toLowerCase()}.`);
    const now = new Date();
    const data: Prisma.CmrUpdateInput = { status: to };
    if (to === "ACKNOWLEDGED") Object.assign(data, { acknowledgedAt: now, acknowledgedByName: actor.name });
    if (to === "ASSIGNED") {
      if (!input.assignedToName) throw new ValidationError("Name the technician or maintenance owner.");
      Object.assign(data, { assignedToName: input.assignedToName, assignedAt: now, ...(c.acknowledgedAt ? {} : { acknowledgedAt: now, acknowledgedByName: actor.name }) });
    }
    if (to === "IN_PROGRESS" && !c.startedAt) data.startedAt = now;
    if (to === "IN_PROGRESS" && c.status === "AWAITING_VERIFICATION") {
      if (!input.note) throw new ValidationError("Record why verification failed.");
      data.outstandingIssues = [c.outstandingIssues, `Verification not accepted (${actor.name}, ${now.toISOString().slice(0, 10)}): ${input.note}`].filter(Boolean).join("\n");
    }
    if (to === "AWAITING_VERIFICATION") {
      if (!c.workDone?.trim()) throw new ValidationError("Record the work carried out before requesting verification.");
      if (!c.completedAt) data.completedAt = now;
    }
    if (to === "COMPLETED") {
      if (!input.note) throw new ValidationError("Record the verification carried out (checks, tests, calibration as applicable).");
      // Segregation of duties: the person who did the work does not verify it.
      if (c.assignedToName && c.assignedToName.trim().toLowerCase() === actor.name.trim().toLowerCase() && actor.role !== "ADMIN") throw new ForbiddenError("The technician who did the work cannot verify it.");
      Object.assign(data, { verifiedById: actor.id, verifiedByName: actor.name, verifiedAt: now, verificationNote: input.note });
      if (c.equipment && input.returnToService && c.equipment.status !== "IN_SERVICE") {
        await tx.equipment.update({ where: { id: c.equipment.id }, data: { status: "IN_SERVICE", statusNote: `Returned to service — ${c.code} verified by ${actor.name}` } });
        await recordEvent(tx, actor, "equipment.status", "Equipment", c.equipment.id, { summary: `${c.equipment.assetNo} returned to service (${c.code})`, before: { status: c.equipment.status }, after: { status: "IN_SERVICE" } });
      }
    }
    if (to === "CLOSED") data.closedAt = now;
    if (to === "CANCELLED") {
      if (!input.note) throw new ValidationError("A reason is required to cancel a CMR.");
      data.cancelReason = input.note;
    }
    const row = await tx.cmr.update({ where: { id }, data });
    await recordEvent(tx, actor, "cmr.status", "Cmr", id, { summary: `${c.code}: ${c.status} → ${to}${input.assignedToName ? ` (${input.assignedToName})` : ""}${input.note ? ` — ${input.note}` : ""}` });
    return row;
  });
}

/** Reopen a completed or closed CMR when the fault returns. The earlier
 *  closure is kept in closureHistory and the audit trail. */
export async function reopenCmr(actor: Actor, id: string, reason: string) {
  assertCan(actor, "cmr.raise");
  if (!reason?.trim()) throw new ValidationError("Describe why the CMR is being reopened.");
  return transaction(async (tx) => {
    const c = found(await tx.cmr.findUnique({ where: { id } }), "CMR");
    if (c.status !== "COMPLETED" && c.status !== "CLOSED") throw new ValidationError("Only a completed or closed CMR can be reopened.");
    const prior = Array.isArray(c.closureHistory) ? (c.closureHistory as Prisma.JsonArray) : [];
    const snapshot = {
      closedAt: c.closedAt?.toISOString() ?? null, completedAt: c.completedAt?.toISOString() ?? null,
      verifiedByName: c.verifiedByName, verifiedAt: c.verifiedAt?.toISOString() ?? null, verificationNote: c.verificationNote,
      diagnosis: c.diagnosis, workDone: c.workDone, partsUsed: c.partsUsed, downtimeHours: c.downtimeHours?.toString() ?? null,
      reopenedAt: new Date().toISOString(), reopenedBy: actor.name, reopenReason: reason.trim(),
    };
    const row = await tx.cmr.update({
      where: { id },
      data: {
        status: "SUBMITTED", reopenCount: { increment: 1 }, closureHistory: [...prior, snapshot],
        closedAt: null, completedAt: null, verifiedById: null, verifiedByName: null, verifiedAt: null, verificationNote: null,
        outstandingIssues: [c.outstandingIssues, `Reopened by ${actor.name}: ${reason.trim()}`].filter(Boolean).join("\n"),
      },
    });
    await recordEvent(tx, actor, "cmr.reopen", "Cmr", id, { summary: `${c.code} reopened — ${reason.trim()}`, before: snapshot });
    return row;
  });
}

// ───────────── attachments ─────────────

const ATTACH_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
export const CMR_ATTACH_MAX_MB = 4;

export async function addCmrAttachment(actor: Actor, id: string, file: { name: string; data: Buffer }, caption?: string | null) {
  assertCan(actor, "cmr.raise");
  const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1].toLowerCase() ?? "";
  if (!ATTACH_EXT[ext]) throw new ValidationError(`File type not allowed. Allowed: ${Object.keys(ATTACH_EXT).join(", ")}.`);
  if (!file.data.length) throw new ValidationError("File is empty.");
  if (file.data.length > CMR_ATTACH_MAX_MB * 1_048_576) throw new ValidationError(`File exceeds ${CMR_ATTACH_MAX_MB} MB.`);
  const c = found(await db.cmr.findUnique({ where: { id }, select: { id: true, code: true } }), "CMR");
  const sha256 = createHash("sha256").update(file.data).digest("hex");
  if (await db.cmrAttachment.findFirst({ where: { cmrId: id, sha256 }, select: { id: true } })) throw new ValidationError("This file is already attached.");
  const storageKey = `cmr/${id}/${randomUUID()}.${ext}`;
  await storage().put(storageKey, file.data, "application/octet-stream");
  return transaction(async (tx) => {
    const row = await tx.cmrAttachment.create({ data: { cmrId: id, fileName: file.name.slice(0, 200), mimeType: ATTACH_EXT[ext], sizeBytes: file.data.length, sha256, storageKey, caption: caption?.slice(0, 500) ?? null, uploadedById: actor.id, uploadedByName: actor.name } });
    await recordEvent(tx, actor, "cmr.attach", "Cmr", id, { summary: `${c.code}: ${row.fileName} attached` });
    return row;
  });
}

// ───────────── queries ─────────────

export interface CmrFilter { status?: "open" | "closed" | CmrStatus | null; equipmentId?: string | null; projectId?: string | null; q?: string | null }

export async function listCmrs(actor: Actor, f: CmrFilter = {}) {
  assertCan(actor, "records.view");
  const status = f.status === "closed" ? { in: ["COMPLETED", "CLOSED", "CANCELLED"] as CmrStatus[] } : f.status && f.status !== "open" ? f.status : f.status === "open" ? { in: [...OPEN_CMR] as CmrStatus[] } : undefined;
  return db.cmr.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(f.equipmentId ? { equipmentId: f.equipmentId } : {}),
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.q ? { OR: [{ code: { contains: f.q, mode: "insensitive" } }, { problem: { contains: f.q, mode: "insensitive" } }, { assetLabel: { contains: f.q, mode: "insensitive" } }, { equipment: { assetNo: { contains: f.q, mode: "insensitive" } } }] } : {}),
    },
    include: { equipment: { select: { assetNo: true, description: true, status: true } }, project: { select: { code: true } } },
    orderBy: [{ reportedAt: "desc" }],
    take: 500,
  });
}

export async function getCmr(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const cmr = found(await db.cmr.findUnique({ where: { id }, include: { equipment: true, project: { select: { id: true, code: true, name: true } }, attachments: { orderBy: { uploadedAt: "desc" } } } }), "CMR");
  const [history, sameAsset] = await Promise.all([
    db.auditEvent.findMany({ where: { entityType: "Cmr", entityId: id }, orderBy: { at: "desc" } }),
    cmr.equipmentId ? db.cmr.findMany({ where: { equipmentId: cmr.equipmentId, id: { not: id } }, orderBy: { reportedAt: "desc" }, take: 20, select: { id: true, code: true, status: true, reportedAt: true, problem: true } }) : Promise.resolve([]),
  ]);
  return { cmr, history, sameAsset };
}

export async function cmrCounts(now = new Date()) {
  const open = await db.cmr.findMany({ where: { status: { in: [...OPEN_CMR] } }, select: { priority: true, requestedBy: true, safetyImpact: true, equipmentUnavailable: true } });
  return {
    open: open.length,
    overdueRequested: open.filter((c) => c.requestedBy && c.requestedBy < now).length,
    critical: open.filter((c) => c.priority === "CRITICAL" || c.safetyImpact).length,
    unavailable: open.filter((c) => c.equipmentUnavailable).length,
  };
}
