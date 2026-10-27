import { AuditStatus, FindingStatus, FindingType } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optDate, optStr, reqDate, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";

export const auditInput = z.object({
  title: reqStr(200),
  auditType: reqStr(120),
  scope: optStr(2000),
  standardRefs: optStr(1000),
  scheduledAt: reqDate,
  auditor: optStr(200),
  status: z.nativeEnum(AuditStatus).optional(),
  summary: optStr(4000),
  checklist: z.preprocess(
    (v) => (typeof v === "string" ? v.split("\n").map((s) => s.trim()).filter(Boolean).map((q) => ({ question: q, answer: null })) : v),
    z.array(z.object({ question: z.string(), answer: z.string().nullable() })).optional(),
  ),
});

export async function saveAudit(actor: Actor, id: string | null, raw: z.input<typeof auditInput>) {
  assertCan(actor, "audit.write");
  const input = auditInput.parse(raw);
  return transaction(async (tx) => {
    if (id) {
      const before = found(await tx.qualityAudit.findUnique({ where: { id } }), "Audit");
      if (input.status === "CLOSED") {
        const open = await tx.auditFinding.count({ where: { auditId: id, status: { not: "CLOSED" } } });
        if (open) throw new ValidationError(`${open} finding(s) are still open.`);
      }
      const row = await tx.qualityAudit.update({ where: { id }, data: input });
      await recordEvent(tx, actor, "audit.update", "QualityAudit", id, { summary: before.code, before, after: input });
      return row;
    }
    const code = await nextCode(tx, "AUD", 4);
    const row = await tx.qualityAudit.create({ data: { ...input, code } });
    await recordEvent(tx, actor, "audit.create", "QualityAudit", row.id, { summary: `${code} ${input.title}`, after: input });
    return row;
  });
}

export const findingInput = z.object({
  type: z.nativeEnum(FindingType),
  description: reqStr(4000),
  clauseRef: optStr(200),
  evidence: optStr(4000),
  ownerName: optStr(200),
  dueDate: optDate,
});

export async function addFinding(actor: Actor, auditId: string, raw: z.input<typeof findingInput>) {
  assertCan(actor, "audit.write");
  const input = findingInput.parse(raw);
  return transaction(async (tx) => {
    const a = found(await tx.qualityAudit.findUnique({ where: { id: auditId } }), "Audit");
    const code = await nextCode(tx, "AF", 4);
    const row = await tx.auditFinding.create({ data: { ...input, auditId, code } });
    await recordEvent(tx, actor, "audit.finding", "QualityAudit", auditId, { summary: `${a.code}: ${code} ${input.type}`, after: input });
    return row;
  });
}

export async function moveFinding(actor: Actor, id: string, status: FindingStatus, evidence?: string | null) {
  assertCan(actor, "audit.write");
  return transaction(async (tx) => {
    const f = found(await tx.auditFinding.findUnique({ where: { id }, include: { actions: true } }), "Finding");
    if (status === "CLOSED") {
      if (f.actions.some((a) => a.status !== "VERIFIED" && a.status !== "CANCELLED")) throw new ValidationError("Verify all actions before closing the finding.");
      if (!evidence && !f.evidence) throw new ValidationError("Record closure evidence.");
    }
    const row = await tx.auditFinding.update({
      where: { id },
      data: { status, evidence: evidence ? [f.evidence, evidence].filter(Boolean).join("\n") : f.evidence, ...(status === "CLOSED" ? { closedAt: new Date(), verifiedById: actor.id } : {}) },
    });
    await recordEvent(tx, actor, "audit.finding.status", "QualityAudit", f.auditId, { summary: `${f.code}: ${f.status} → ${status}` });
    return row;
  });
}

export async function listAudits(actor: Actor) {
  assertCan(actor, "records.view");
  return db.qualityAudit.findMany({ orderBy: { scheduledAt: "desc" }, include: { findings: { select: { status: true, dueDate: true, type: true } } } });
}

export async function getAudit(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const audit = found(await db.qualityAudit.findUnique({ where: { id }, include: { findings: { include: { actions: true }, orderBy: { createdAt: "asc" } } } }), "Audit");
  const history = await db.auditEvent.findMany({ where: { entityType: "QualityAudit", entityId: id }, orderBy: { at: "desc" } });
  return { audit, history };
}
