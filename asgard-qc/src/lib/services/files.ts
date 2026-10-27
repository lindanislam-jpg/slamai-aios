import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import { PROJECT_FILE_CATEGORIES, PROJECT_FILE_EXTENSIONS, PROJECT_FILE_MAX_MB } from "../domain/constants";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { storage } from "../storage";
import { optId, optStr } from "../validation";
import { assertCan, found, transaction } from "./base";

/**
 * Files attached to a project: drawings, POs, certificates, correspondence,
 * QC packs. Unlike controlled documents there is no approval workflow; files
 * are kept as uploaded and can only be withdrawn with a recorded reason.
 */

export const projectFileMeta = z.object({
  category: z.enum(PROJECT_FILE_CATEGORIES, { error: "Choose a category" }),
  unitId: optId,
  notes: optStr(1000),
});
export type ProjectFileMeta = z.input<typeof projectFileMeta>;

const MAX_BYTES = PROJECT_FILE_MAX_MB * 1_048_576;

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
};

function extensionOf(name: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Validate a file name and return its allowed extension. */
export function checkFileName(name: string) {
  const ext = extensionOf(name);
  if (!ext || !(PROJECT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ValidationError(`File type not allowed. Allowed: ${PROJECT_FILE_EXTENSIONS.join(", ")}.`);
  }
  return ext;
}

/** Storage key for a new file. The prefix ties the key to the project so a
 *  browser upload cannot be registered against a different project. */
export function newFileKey(projectId: string, fileName: string) {
  return `project-files/${projectId}/${randomUUID()}.${checkFileName(fileName)}`;
}

export function keyBelongsToProject(key: string, projectId: string) {
  return new RegExp(`^project-files/${projectId}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`).test(key);
}

async function assertUnitInProject(projectId: string, unitId: string | null | undefined) {
  if (!unitId) return;
  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { projectId: true } });
  if (!unit || unit.projectId !== projectId) throw new ValidationError("Module/frame belongs to a different project.");
}

/** Record a file whose bytes are already in storage under `storageKey`. */
async function recordFile(actor: Actor, projectId: string, storageKey: string, fileName: string, data: Buffer, meta: z.output<typeof projectFileMeta>) {
  const sha256 = createHash("sha256").update(data).digest("hex");
  const dupe = await db.projectFile.findFirst({ where: { projectId, sha256, removedAt: null }, select: { code: true } });
  if (dupe) throw new ValidationError(`Already attached to this project as ${dupe.code}.`);
  const ext = checkFileName(fileName);
  return transaction(async (tx) => {
    const code = await nextCode(tx, "FL", 6);
    const row = await tx.projectFile.create({
      data: {
        code,
        projectId,
        unitId: meta.unitId ?? null,
        category: meta.category,
        notes: meta.notes ?? null,
        fileName: fileName.slice(0, 200),
        mimeType: MIME[ext] ?? "application/octet-stream",
        sizeBytes: data.length,
        sha256,
        storageKey,
        uploadedById: actor.id,
        uploadedByName: actor.name,
      },
    });
    await recordEvent(tx, actor, "file.upload", "ProjectFile", row.id, { summary: `${code} ${row.fileName} (${meta.category})`, after: { category: meta.category, sha256, sizeBytes: data.length } });
    return row;
  });
}

export type FileUploadResult = { name: string; ok: true; id: string; code: string } | { name: string; ok: false; error: string };

/** Server-side upload: bytes arrive in the request (self-hosted, S3, Netlify). */
export async function uploadProjectFiles(actor: Actor, projectId: string, files: { name: string; data: Buffer }[], rawMeta: ProjectFileMeta): Promise<FileUploadResult[]> {
  assertCan(actor, "file.upload");
  if (files.length === 0) throw new ValidationError("Choose at least one file.");
  const meta = projectFileMeta.parse(rawMeta);
  found(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }), "Project");
  await assertUnitInProject(projectId, meta.unitId);
  const results: FileUploadResult[] = [];
  for (const f of files) {
    const name = f.name.slice(0, 200) || "file";
    try {
      if (f.data.length === 0) throw new ValidationError("File is empty.");
      if (f.data.length > MAX_BYTES) throw new ValidationError(`File exceeds ${PROJECT_FILE_MAX_MB} MB.`);
      const key = newFileKey(projectId, name);
      await storage().put(key, f.data, "application/octet-stream");
      const row = await recordFile(actor, projectId, key, name, f.data, meta);
      results.push({ name, ok: true, id: row.id, code: row.code });
    } catch (err) {
      results.push({ name, ok: false, error: err instanceof ValidationError ? err.message : "Could not store this file." });
      if (!(err instanceof ValidationError)) console.error("file upload failed", err);
    }
  }
  return results;
}

/** Browser-direct upload (Vercel Blob): the bytes are already stored under a
 *  key issued for this project; read them back to verify and fingerprint. */
export async function registerUploadedFile(actor: Actor, projectId: string, input: { key: string; fileName: string } & ProjectFileMeta) {
  assertCan(actor, "file.upload");
  const meta = projectFileMeta.parse(input);
  found(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }), "Project");
  await assertUnitInProject(projectId, meta.unitId);
  if (!keyBelongsToProject(input.key, projectId)) throw new ValidationError("Upload does not belong to this project.");
  if (await db.projectFile.findUnique({ where: { storageKey: input.key }, select: { id: true } })) throw new ValidationError("This upload is already recorded.");
  let data: Buffer;
  try {
    data = await storage().get(input.key);
  } catch {
    throw new ValidationError("Uploaded file not found. Try again.");
  }
  if (data.length === 0 || data.length > MAX_BYTES) {
    await storage().remove(input.key).catch(() => undefined);
    throw new ValidationError(data.length === 0 ? "File is empty." : `File exceeds ${PROJECT_FILE_MAX_MB} MB.`);
  }
  try {
    return await recordFile(actor, projectId, input.key, input.fileName, data, meta);
  } catch (err) {
    // Not recorded (duplicate, bad type): the stray upload is not evidence, remove it.
    await storage().remove(input.key).catch(() => undefined);
    throw err;
  }
}

export async function listProjectFiles(actor: Actor, projectId: string, opts: { includeRemoved?: boolean } = {}) {
  assertCan(actor, "records.view");
  return db.projectFile.findMany({
    where: { projectId, ...(opts.includeRemoved ? {} : { removedAt: null }) },
    orderBy: [{ category: "asc" }, { uploadedAt: "desc" }],
    include: { unit: { select: { ref: true } } },
  });
}

/** Withdraw a file from the project. The record and the stored bytes are kept
 *  for the audit trail; it just stops being listed and counted. */
export async function removeProjectFile(actor: Actor, id: string, reason: string) {
  assertCan(actor, "file.remove");
  if (!reason.trim()) throw new ValidationError("A reason is required to remove a file.");
  const before = found(await db.projectFile.findUnique({ where: { id } }), "File");
  if (before.removedAt) throw new ValidationError("File already removed.");
  await transaction(async (tx) => {
    await tx.projectFile.update({ where: { id }, data: { removedAt: new Date(), removedByName: actor.name, removeReason: reason.trim().slice(0, 500) } });
    await recordEvent(tx, actor, "file.remove", "ProjectFile", id, { summary: `${before.code} ${before.fileName}: ${reason.trim()}` });
  });
}
