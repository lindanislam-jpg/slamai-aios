import { InspectionResult, InspectionType, RecordStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import { ForbiddenError, ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optDate, optId, optStr, reqStr } from "../validation";
import { assertCan, dateRange, found, transaction } from "./base";

const FAB_TYPES: InspectionType[] = ["FABRICATION", "DIMENSIONAL"];

function assertCanWrite(actor: Actor, type: InspectionType) {
  if (actor.permissions.has("inspection.write")) return;
  if (FAB_TYPES.includes(type) && actor.permissions.has("fabrication.write")) return;
  throw new ForbiddenError();
}

export const checklistItemInput = z.object({
  description: reqStr(500),
  requirement: optStr(1000),
  tolerance: optStr(200),
  actual: optStr(200),
  unit: optStr(40),
  result: z.nativeEnum(InspectionResult).default("PENDING"),
  notes: optStr(1000),
  required: z.boolean().default(true),
});

export const inspectionInput = z.object({
  projectId: reqStr(),
  unitId: optId,
  type: z.nativeEnum(InspectionType),
  operation: optStr(120),
  stage: optStr(120),
  componentRef: optStr(200),
  drawingRef: optStr(200),
  plannedDate: optDate,
  inspectedAt: optDate,
  inspectorName: optStr(200),
  criteriaRef: optStr(500),
  result: z.nativeEnum(InspectionResult).optional(),
  comments: optStr(4000),
  reinspectionOfId: optId,
  templateId: optId,
  items: z.array(checklistItemInput).max(200).optional(),
});
export type InspectionInput = z.input<typeof inspectionInput>;

export async function createInspection(actor: Actor, raw: InspectionInput) {
  const input = inspectionInput.parse(raw);
  assertCanWrite(actor, input.type);
  const { items, templateId, ...data } = input;
  return transaction(async (tx) => {
    let rows = items ?? [];
    if (templateId) {
      const tpl = found(await tx.checklistTemplate.findUnique({ where: { id: templateId } }), "Checklist template");
      const tplItems = z.array(checklistItemInput.partial({ result: true })).parse(tpl.items);
      rows = [...tplItems.map((i) => ({ ...checklistItemInput.parse({ ...i, result: "PENDING" }) })), ...rows];
      if (!data.criteriaRef && tpl.documentRef) data.criteriaRef = tpl.documentRef;
    }
    if (data.unitId) {
      const unit = found(await tx.unit.findUnique({ where: { id: data.unitId } }), "Module / frame");
      if (unit.projectId !== data.projectId) throw new ValidationError("That module/frame belongs to a different project.");
    }
    if (data.reinspectionOfId) {
      const orig = found(await tx.inspection.findUnique({ where: { id: data.reinspectionOfId } }), "Original inspection");
      if (orig.projectId !== data.projectId) throw new ValidationError("Re-inspection must be in the same project.");
    }
    const code = await nextCode(tx, "INS", 6);
    const inspection = await tx.inspection.create({
      data: {
        ...data,
        code,
        inspectorId: actor.id,
        inspectorName: data.inspectorName ?? actor.name,
        items: {
          create: rows.map((r, idx) => ({
            ...r,
            order: idx + 1,
            // An item with no requirement text is flagged, never assumed.
            criteriaStatus: r.requirement ? "DEFINED" : "REQUIRES_CONFIGURATION",
          })),
        },
      },
      include: { items: true },
    });
    await recordEvent(tx, actor, "inspection.create", "Inspection", inspection.id, { summary: `${code} ${data.type}`, after: data });
    return inspection;
  });
}

const LOCKED: RecordStatus[] = ["REVIEWED", "ACCEPTED", "REJECTED", "CANCELLED"];

export async function updateInspection(actor: Actor, id: string, raw: Partial<InspectionInput>) {
  const input = inspectionInput.omit({ projectId: true, templateId: true, items: true }).partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.inspection.findUnique({ where: { id } }), "Inspection");
    assertCanWrite(actor, before.type);
    if (LOCKED.includes(before.status)) throw new ValidationError(`${before.code} is ${before.status.toLowerCase()} and can no longer be edited.`);
    const row = await tx.inspection.update({ where: { id }, data: input });
    const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "inspection.update", "Inspection", id, { summary: before.code, before: d.before, after: d.after });
    return row;
  });
}

export async function saveChecklist(actor: Actor, id: string, items: z.input<typeof checklistItemInput>[]) {
  const parsed = z.array(checklistItemInput).parse(items);
  return transaction(async (tx) => {
    const before = found(await tx.inspection.findUnique({ where: { id }, include: { items: true } }), "Inspection");
    assertCanWrite(actor, before.type);
    if (LOCKED.includes(before.status)) throw new ValidationError(`${before.code} is locked.`);
    await tx.checklistItem.deleteMany({ where: { inspectionId: id } });
    await tx.checklistItem.createMany({
      data: parsed.map((r, idx) => ({ ...r, inspectionId: id, order: idx + 1, criteriaStatus: r.requirement ? "DEFINED" : "REQUIRES_CONFIGURATION" })),
    });
    await recordEvent(tx, actor, "inspection.checklist", "Inspection", id, {
      summary: `${before.code} checklist saved (${parsed.length} items)`,
      before: before.items.map(({ description, actual, result }) => ({ description, actual, result })),
      after: parsed.map(({ description, actual, result }) => ({ description, actual, result })),
    });
  });
}

/** Rules for submitting a result: a result must be chosen, required items
 *  must be answered, and PASS is refused while a required item failed. */
export function submissionProblems(insp: { result: InspectionResult; inspectedAt: Date | null; items: { description: string; result: InspectionResult; required: boolean }[] }) {
  const problems: string[] = [];
  if (insp.result === "PENDING") problems.push("Choose an overall result.");
  if (!insp.inspectedAt) problems.push("Record the inspection date/time.");
  const open = insp.items.filter((i) => i.required && i.result === "PENDING");
  if (open.length) problems.push(`${open.length} required checklist item(s) have no result.`);
  if (insp.result === "PASS" && insp.items.some((i) => i.required && i.result === "FAIL")) {
    problems.push("Overall result cannot be Pass while a required checklist item failed.");
  }
  return problems;
}

export async function submitInspection(actor: Actor, id: string) {
  return transaction(async (tx) => {
    const insp = found(await tx.inspection.findUnique({ where: { id }, include: { items: true } }), "Inspection");
    assertCanWrite(actor, insp.type);
    if (insp.status !== "DRAFT") throw new ValidationError(`${insp.code} has already been submitted.`);
    const problems = submissionProblems(insp);
    if (problems.length) throw new ValidationError(problems.join(" "));
    const row = await tx.inspection.update({ where: { id }, data: { status: "SUBMITTED" } });
    await recordEvent(tx, actor, "inspection.submit", "Inspection", id, { summary: `${insp.code} submitted — ${insp.result}` });
    return row;
  });
}

export async function reviewInspection(actor: Actor, id: string, decision: "ACCEPTED" | "REJECTED", note?: string | null) {
  assertCan(actor, "inspection.review");
  return transaction(async (tx) => {
    const insp = found(await tx.inspection.findUnique({ where: { id } }), "Inspection");
    if (insp.status !== "SUBMITTED" && insp.status !== "REVIEWED") throw new ValidationError(`${insp.code} must be submitted before review.`);
    // Segregation of duties: nobody signs off their own inspection.
    if (insp.inspectorId === actor.id && actor.role !== "ADMIN") throw new ForbiddenError("You cannot review an inspection you recorded.");
    if (decision === "REJECTED" && !note) throw new ValidationError("Give a reason when rejecting an inspection record.");
    const row = await tx.inspection.update({
      where: { id },
      data: {
        status: decision,
        reviewerId: actor.id,
        reviewerName: actor.name,
        reviewedAt: new Date(),
        comments: note ? [insp.comments, `Review (${actor.name}): ${note}`].filter(Boolean).join("\n") : insp.comments,
      },
    });
    await recordEvent(tx, actor, `inspection.${decision.toLowerCase()}`, "Inspection", id, { summary: `${insp.code} ${decision.toLowerCase()}${note ? `: ${note}` : ""}` });
    return row;
  });
}

export async function cancelInspection(actor: Actor, id: string, reason: string) {
  assertCan(actor, "inspection.review");
  if (!reason?.trim()) throw new ValidationError("A reason is required.");
  return transaction(async (tx) => {
    const insp = found(await tx.inspection.findUnique({ where: { id } }), "Inspection");
    if (insp.status === "ACCEPTED") throw new ValidationError("Accepted inspections cannot be cancelled.");
    await tx.inspection.update({ where: { id }, data: { status: "CANCELLED" } });
    await recordEvent(tx, actor, "inspection.cancel", "Inspection", id, { summary: `${insp.code}: ${reason}` });
  });
}

export interface InspectionFilter {
  projectId?: string | null;
  unitId?: string | null;
  type?: InspectionType | InspectionType[] | null;
  result?: InspectionResult | null;
  status?: RecordStatus | null;
  inspector?: string | null;
  stage?: string | null;
  from?: Date | null;
  to?: Date | null;
  q?: string | null;
  /** Not completed (draft/rejected) with a planned date in the past. */
  overdue?: boolean;
  take?: number;
}

export function inspectionWhere(f: InspectionFilter): Prisma.InspectionWhereInput {
  return {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.unitId ? { unitId: f.unitId } : {}),
    ...(f.type ? { type: Array.isArray(f.type) ? { in: f.type } : f.type } : {}),
    ...(f.result ? { result: f.result } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.stage ? { stage: f.stage } : {}),
    ...(f.inspector ? { inspectorName: { contains: f.inspector, mode: "insensitive" } } : {}),
    ...(f.from || f.to ? { OR: [{ inspectedAt: dateRange(f.from, f.to) }, { inspectedAt: null, plannedDate: dateRange(f.from, f.to) }] } : {}),
    ...(f.overdue ? { plannedDate: { lt: new Date() }, status: { in: ["DRAFT", "REJECTED"] } } : {}),
    ...(f.q
      ? {
          AND: [
            {
              OR: [
                { code: { contains: f.q, mode: "insensitive" } },
                { componentRef: { contains: f.q, mode: "insensitive" } },
                { drawingRef: { contains: f.q, mode: "insensitive" } },
                { comments: { contains: f.q, mode: "insensitive" } },
                { unit: { ref: { contains: f.q, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
  };
}

export async function listInspections(actor: Actor, f: InspectionFilter) {
  assertCan(actor, "records.view");
  return db.inspection.findMany({
    where: inspectionWhere(f),
    orderBy: [{ inspectedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    take: f.take ?? 200,
    include: {
      project: { select: { code: true } },
      unit: { select: { ref: true } },
      _count: { select: { photos: true, ncrs: true, items: true } },
    },
  });
}

export async function getInspection(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const insp = found(
    await db.inspection.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, ref: true } },
        items: { orderBy: { order: "asc" } },
        photos: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
        ncrs: { select: { id: true, code: true, status: true, priority: true } },
        reinspectionOf: { select: { id: true, code: true, result: true } },
        reinspections: { select: { id: true, code: true, result: true } },
      },
    }),
    "Inspection",
  );
  const history = await db.auditEvent.findMany({ where: { entityType: "Inspection", entityId: id }, orderBy: { at: "desc" } });
  return { insp, history };
}

// ── Checklist templates ──

export const templateInput = z.object({
  name: reqStr(200),
  inspectionType: z.nativeEnum(InspectionType),
  documentRef: optStr(300),
  items: z.array(checklistItemInput.omit({ actual: true, result: true, notes: true })).min(1, "Add at least one item").max(200),
});

export async function saveTemplate(actor: Actor, id: string | null, raw: z.input<typeof templateInput>) {
  assertCan(actor, "settings.manage");
  const input = templateInput.parse(raw);
  return transaction(async (tx) => {
    const row = id
      ? await tx.checklistTemplate.update({ where: { id }, data: { ...input, approved: false, approvedById: null, approvedAt: null } })
      : await tx.checklistTemplate.create({ data: input });
    await recordEvent(tx, actor, id ? "template.update" : "template.create", "ChecklistTemplate", row.id, { summary: input.name, after: input });
    return row;
  });
}

export async function approveTemplate(actor: Actor, id: string) {
  assertCan(actor, "document.approve");
  return transaction(async (tx) => {
    const row = await tx.checklistTemplate.update({ where: { id }, data: { approved: true, approvedById: actor.id, approvedAt: new Date() } });
    await recordEvent(tx, actor, "template.approve", "ChecklistTemplate", id, { summary: row.name });
    return row;
  });
}
