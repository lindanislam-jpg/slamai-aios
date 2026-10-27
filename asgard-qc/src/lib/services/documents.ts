import { DocStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { getSetting } from "../settings";
import { storage } from "../storage";
import { optId, optNum, optStr, reqDate, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";

export const documentInput = z.object({
  docNo: reqStr(120),
  title: reqStr(300),
  docType: reqStr(120),
  projectId: optId,
  ownerName: optStr(200),
});

export async function createDocument(actor: Actor, raw: z.input<typeof documentInput>) {
  assertCan(actor, "document.write");
  const input = documentInput.parse(raw);
  return transaction(async (tx) => {
    const row = await tx.document.create({ data: input });
    await recordEvent(tx, actor, "document.create", "Document", row.id, { summary: `${input.docNo} ${input.title}`, after: input });
    return row;
  });
}

const ALLOWED_DOC_TYPES: Record<string, string> = {
  "%PDF": "application/pdf",
  "\x89PNG": "image/png",
  "\xff\xd8\xff": "image/jpeg",
  "PK\x03\x04": "application/zip", // docx/xlsx are zip containers
};

function sniffDoc(buf: Buffer): string | null {
  const head = buf.subarray(0, 4).toString("latin1");
  for (const [sig, mime] of Object.entries(ALLOWED_DOC_TYPES)) if (head.startsWith(sig)) return mime;
  return null;
}

/** Add a new revision. Existing revisions are never replaced: the unique
 *  (document, revision) constraint rejects a duplicate revision label. */
export async function addRevision(actor: Actor, documentId: string, raw: { revision: string; notes?: string | null }, file?: { name: string; data: Buffer } | null) {
  assertCan(actor, "document.write");
  const revision = reqStr(40).parse(raw.revision);
  const doc = found(await db.document.findUnique({ where: { id: documentId }, include: { revisions: true } }), "Document");
  if (doc.revisions.some((r) => r.revision === revision)) throw new ValidationError(`Revision ${revision} already exists. Issue a new revision instead of overwriting.`);

  let fileData: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string } | null = null;
  if (file) {
    const limits = await getSetting("uploadLimits");
    if (file.data.length > limits.maxFileMb * 1_048_576) throw new ValidationError(`File exceeds ${limits.maxFileMb} MB.`);
    const mime = sniffDoc(file.data);
    if (!mime) throw new ValidationError("Documents must be PDF, PNG, JPG, DOCX or XLSX.");
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const storageKey = `documents/${documentId}/${randomUUID()}.${ext}`;
    await storage().put(storageKey, file.data, mime);
    fileData = { storageKey, fileName: file.name.slice(0, 200), mimeType: mime, sizeBytes: file.data.length, sha256: createHash("sha256").update(file.data).digest("hex") };
  }
  return transaction(async (tx) => {
    const rev = await tx.documentRevision.create({
      data: { documentId, revision, notes: raw.notes ?? null, status: "UNDER_REVIEW", uploadedById: actor.id, uploadedByName: actor.name, ...(fileData ?? {}) },
    });
    if (doc.status === "DRAFT") await tx.document.update({ where: { id: documentId }, data: { status: "UNDER_REVIEW" } });
    await recordEvent(tx, actor, "document.revision", "Document", documentId, { summary: `${doc.docNo} rev ${revision} uploaded${fileData ? ` (${fileData.fileName}, sha256 ${fileData.sha256.slice(0, 12)}…)` : " (reference only)"}` });
    return rev;
  });
}

/** Approve a revision; the previously approved one becomes SUPERSEDED. */
export async function approveRevision(actor: Actor, revisionId: string) {
  assertCan(actor, "document.approve");
  return transaction(async (tx) => {
    const rev = found(await tx.documentRevision.findUnique({ where: { id: revisionId }, include: { document: true } }), "Revision");
    if (rev.status !== "UNDER_REVIEW") throw new ValidationError("Only revisions under review can be approved.");
    if (rev.uploadedById === actor.id && actor.role !== "ADMIN") throw new ValidationError("A revision must be approved by someone other than the uploader.");
    await tx.documentRevision.updateMany({ where: { documentId: rev.documentId, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    await tx.documentRevision.update({ where: { id: revisionId }, data: { status: "APPROVED", approvedById: actor.id, approvedByName: actor.name, approvedAt: new Date() } });
    await tx.document.update({ where: { id: rev.documentId }, data: { status: "APPROVED" } });
    await recordEvent(tx, actor, "document.approve", "Document", rev.documentId, { summary: `${rev.document.docNo} rev ${rev.revision} approved` });
  });
}

export async function setDocumentStatus(actor: Actor, id: string, status: DocStatus) {
  assertCan(actor, "document.approve");
  return transaction(async (tx) => {
    const d = found(await tx.document.findUnique({ where: { id } }), "Document");
    await tx.document.update({ where: { id }, data: { status } });
    await recordEvent(tx, actor, "document.status", "Document", id, { summary: `${d.docNo}: ${d.status} → ${status}` });
  });
}

export async function listDocuments(actor: Actor, f: { q?: string | null; docType?: string | null; projectId?: string | null; status?: DocStatus | null }) {
  assertCan(actor, "records.view");
  return db.document.findMany({
    where: {
      ...(f.docType ? { docType: f.docType } : {}),
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { OR: [{ docNo: { contains: f.q, mode: "insensitive" } }, { title: { contains: f.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { docNo: "asc" },
    include: { project: { select: { code: true } }, revisions: { orderBy: { uploadedAt: "desc" } } },
  });
}

// ── Calibration ──

export const equipmentInput = z.object({
  assetNo: reqStr(80),
  description: reqStr(300),
  serialNo: optStr(120),
  location: optStr(200),
  intervalDays: optNum,
});

export async function createEquipment(actor: Actor, raw: z.input<typeof equipmentInput>) {
  assertCan(actor, "calibration.write");
  const input = equipmentInput.parse(raw);
  return transaction(async (tx) => {
    const row = await tx.equipment.create({ data: { ...input, intervalDays: input.intervalDays ?? null } });
    await recordEvent(tx, actor, "equipment.create", "Equipment", row.id, { summary: input.assetNo, after: input });
    return row;
  });
}

export const calibrationInput = z.object({
  calibratedAt: reqDate,
  dueAt: reqDate,
  certificateRef: optStr(200),
  provider: optStr(200),
  result: optStr(200),
});

export async function addCalibration(actor: Actor, equipmentId: string, raw: z.input<typeof calibrationInput>) {
  assertCan(actor, "calibration.write");
  const input = calibrationInput.parse(raw);
  if (input.dueAt <= input.calibratedAt) throw new ValidationError("Due date must be after the calibration date.");
  return transaction(async (tx) => {
    const eq = found(await tx.equipment.findUnique({ where: { id: equipmentId } }), "Equipment");
    const row = await tx.calibrationRecord.create({ data: { ...input, equipmentId } });
    await recordEvent(tx, actor, "calibration.add", "Equipment", equipmentId, { summary: `${eq.assetNo} calibrated, due ${input.dueAt.toISOString().slice(0, 10)}` });
    return row;
  });
}

export type CalStatus = "CURRENT" | "DUE_SOON" | "EXPIRED" | "NO_RECORD";

export function calibrationStatus(latestDue: Date | null | undefined, soonDays: number, now = new Date()): CalStatus {
  if (!latestDue) return "NO_RECORD";
  if (latestDue < now) return "EXPIRED";
  if (latestDue.getTime() - now.getTime() <= soonDays * 86_400_000) return "DUE_SOON";
  return "CURRENT";
}

export async function listEquipment(actor: Actor) {
  assertCan(actor, "records.view");
  const soon = (await getSetting("notificationThresholds")).calibrationDueSoonDays;
  const rows = await db.equipment.findMany({ orderBy: { assetNo: "asc" }, include: { calibrations: { orderBy: { dueAt: "desc" } } } });
  return rows.map((e) => ({ ...e, latest: e.calibrations[0] ?? null, calStatus: calibrationStatus(e.calibrations[0]?.dueAt, soon) }));
}
