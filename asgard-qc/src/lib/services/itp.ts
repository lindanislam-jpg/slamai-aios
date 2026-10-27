import type { ControlPointType } from "@prisma/client";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import { parseItpWorkbook, type ParsedItp } from "../import/itp";
import type { Actor } from "../permissions";
import { assertCan, found, transaction } from "./base";

/** Hold and Accept points are formal approvals; everything else is an
 *  inspector's sign-off. */
export function signPermission(type: ControlPointType | null) {
  return type === "H" || type === "A" ? ("inspection.review" as const) : ("inspection.write" as const);
}

export async function applyItp(actor: Actor, projectId: string, file: { name: string; data: Buffer }, disciplines?: string[]) {
  assertCan(actor, "project.write");
  found(await db.project.findUnique({ where: { id: projectId } }), "Project");
  let parsed;
  try {
    parsed = await parseItpWorkbook(file.data);
  } catch {
    throw new ValidationError("The file could not be read as an Excel ITP workbook.");
  }
  const chosen = disciplines?.length ? parsed.filter((p) => disciplines.includes(p.discipline)) : parsed;
  return applyParsedItp(actor, projectId, chosen, file.name);
}

/** Apply already-parsed ITP tables to a project (one plan per discipline). */
export async function applyParsedItp(actor: Actor, projectId: string, chosen: ParsedItp[], sourceName: string) {
  assertCan(actor, "project.write");
  found(await db.project.findUnique({ where: { id: projectId } }), "Project");
  if (!chosen.length) throw new ValidationError("No ITP tables found (expected a header row starting “Item | Inspection Activity”).");
  const existing = await db.itpPlan.findMany({ where: { projectId, discipline: { in: chosen.map((c) => c.discipline) } }, select: { discipline: true } });
  if (existing.length) throw new ValidationError(`Already applied to this project: ${existing.map((e) => e.discipline).join(", ")}.`);

  return transaction(async (tx) => {
    const created = [];
    for (const itp of chosen) {
      const plan = await tx.itpPlan.create({
        data: {
          projectId,
          discipline: itp.discipline,
          documentRef: itp.documentRef,
          sourceFile: sourceName.slice(0, 200),
          createdById: actor.id,
          points: { create: itp.points.map((p, i) => ({ ...p, order: i + 1 })) },
        },
        include: { points: true },
      });
      created.push({ discipline: plan.discipline, points: plan.points.length, holds: plan.points.filter((p) => p.pointType === "H").length, warnings: itp.warnings });
      await recordEvent(tx, actor, "itp.apply", "Project", projectId, { summary: `ITP ${itp.documentRef ?? ""} ${itp.discipline} applied (${plan.points.length} control points) from ${sourceName}` });
    }
    return created;
  });
}

export async function signControlPoint(actor: Actor, id: string, evidence: string) {
  const p = found(await db.controlPoint.findUnique({ where: { id }, include: { plan: true } }), "Control point");
  assertCan(actor, signPermission(p.pointType));
  if (p.status !== "OPEN") throw new ValidationError("This control point is already closed.");
  if (!evidence?.trim()) throw new ValidationError("Record the evidence (document / report reference) for this sign-off.");
  return transaction(async (tx) => {
    const row = await tx.controlPoint.update({ where: { id }, data: { status: "SIGNED", signedById: actor.id, signedByName: actor.name, signedAt: new Date(), evidence } });
    await recordEvent(tx, actor, "itp.sign", "Project", p.plan.projectId, { summary: `ITP ${p.plan.discipline} item ${p.itemNo} (${p.pointType ?? "-"}) signed: ${evidence}` });
    return row;
  });
}

export async function markNotApplicable(actor: Actor, id: string, reason: string) {
  assertCan(actor, "inspection.review");
  if (!reason?.trim()) throw new ValidationError("Give the reason this control point does not apply.");
  const p = found(await db.controlPoint.findUnique({ where: { id }, include: { plan: true } }), "Control point");
  if (p.status !== "OPEN") throw new ValidationError("This control point is already closed.");
  return transaction(async (tx) => {
    const row = await tx.controlPoint.update({ where: { id }, data: { status: "NOT_APPLICABLE", signedById: actor.id, signedByName: actor.name, signedAt: new Date(), evidence: `N/A: ${reason}` } });
    await recordEvent(tx, actor, "itp.not_applicable", "Project", p.plan.projectId, { summary: `ITP ${p.plan.discipline} item ${p.itemNo} marked not applicable: ${reason}` });
    return row;
  });
}

export async function reopenControlPoint(actor: Actor, id: string, reason: string) {
  assertCan(actor, "inspection.review");
  if (!reason?.trim()) throw new ValidationError("A reason is required to reopen a control point.");
  const p = found(await db.controlPoint.findUnique({ where: { id }, include: { plan: true } }), "Control point");
  return transaction(async (tx) => {
    const row = await tx.controlPoint.update({ where: { id }, data: { status: "OPEN", signedById: null, signedByName: null, signedAt: null } });
    await recordEvent(tx, actor, "itp.reopen", "Project", p.plan.projectId, { summary: `ITP ${p.plan.discipline} item ${p.itemNo} reopened: ${reason}`, before: { status: p.status, evidence: p.evidence } });
    return row;
  });
}

export async function projectItp(actor: Actor, projectId: string) {
  assertCan(actor, "records.view");
  return db.itpPlan.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { points: { orderBy: { order: "asc" } } } });
}
