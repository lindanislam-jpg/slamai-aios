import { ReviewStatus, ReworkPhase, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, type Tx } from "../db";
import { diff, recordEvent } from "../audit";
import { ValidationError } from "../errors";
import { processImage } from "../images";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { getSetting } from "../settings";
import { storage } from "../storage";
import { optId, optStr } from "../validation";
import { assertCan, dateRange, found, transaction } from "./base";

export const photoMetaInput = z.object({
  unitId: optId,
  componentRef: optStr(200),
  stage: optStr(120),
  category: z.string().trim().min(1, "Category is required").max(120),
  inspectionType: optStr(120),
  responsiblePerson: optStr(200),
  heatNumber: optStr(120),
  weldRef: optStr(120),
  inspectionId: optId,
  ncrId: optId,
  weldId: optId,
  materialId: optId,
  repairId: optId,
  reworkPhase: z.preprocess((v) => (v === "" ? null : v), z.nativeEnum(ReworkPhase).nullable().optional()),
  caption: optStr(300),
  description: optStr(4000),
  observedCondition: optStr(2000),
  correctiveAction: optStr(2000),
  tags: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((t) => t.trim()).filter(Boolean) : v ?? []),
    z.array(z.string().max(60)).max(30),
  ).optional(),
});
export type PhotoMeta = z.input<typeof photoMetaInput>;

/** Every linked record must belong to the same project as the photo. */
async function assertLinksInProject(tx: Tx, projectId: string, m: Partial<z.output<typeof photoMetaInput>>) {
  const checks: [string, Promise<{ projectId: string | null } | null>][] = [];
  if (m.unitId) checks.push(["Module/frame", tx.unit.findUnique({ where: { id: m.unitId }, select: { projectId: true } })]);
  if (m.inspectionId) checks.push(["Inspection", tx.inspection.findUnique({ where: { id: m.inspectionId }, select: { projectId: true } })]);
  if (m.ncrId) checks.push(["NCR", tx.ncr.findUnique({ where: { id: m.ncrId }, select: { projectId: true } })]);
  if (m.weldId) checks.push(["Weld", tx.weld.findUnique({ where: { id: m.weldId }, select: { projectId: true } })]);
  if (m.repairId) checks.push(["Repair", tx.repair.findUnique({ where: { id: m.repairId }, select: { projectId: true } })]);
  if (m.materialId) checks.push(["Material", tx.material.findUnique({ where: { id: m.materialId }, select: { projectId: true } })]);
  for (const [label, p] of checks) {
    const row = await p;
    if (!row) throw new ValidationError(`${label} link not found.`);
    // Materials may be held in general stock (no project).
    if (row.projectId && row.projectId !== projectId) throw new ValidationError(`${label} belongs to a different project.`);
  }
}

export interface UploadFile {
  name: string;
  data: Buffer;
}

export type UploadResult =
  | { name: string; ok: true; id: string; code: string; takenAt: Date | null; previewAvailable: boolean }
  | { name: string; ok: false; error: string };

/**
 * Store a batch of photographs. Each file is validated and stored
 * independently so one bad file doesn't sink the batch. Originals are kept
 * byte-for-byte; thumbnails are derived copies.
 */
export async function uploadPhotos(actor: Actor, projectId: string, files: UploadFile[], rawMeta: PhotoMeta): Promise<UploadResult[]> {
  assertCan(actor, "photo.upload");
  const limits = await getSetting("uploadLimits");
  if (files.length === 0) throw new ValidationError("Choose at least one photo.");
  if (files.length > limits.maxFilesPerBatch) throw new ValidationError(`Upload at most ${limits.maxFilesPerBatch} photos at a time.`);
  const meta = photoMetaInput.parse(rawMeta);
  found(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }), "Project");
  await assertLinksInProject(db, projectId, meta);

  const results: UploadResult[] = [];
  for (const file of files) {
    const name = file.name.slice(0, 200) || "photo";
    try {
      results.push(await storePhoto(actor, projectId, meta, name, file.data, limits.maxFileMb, null));
    } catch (err) {
      results.push({ name, ok: false, error: err instanceof ValidationError ? err.message : "Could not store this file." });
      if (!(err instanceof ValidationError)) console.error("photo upload failed", err);
    }
  }
  return results;
}

/**
 * Validate, fingerprint and record one photo. When `uploadedKey` is given the
 * original is already in storage (browser-direct upload) and is kept where it
 * is; otherwise it is written under a new key.
 */
async function storePhoto(actor: Actor, projectId: string, meta: z.output<typeof photoMetaInput>, name: string, data: Buffer, maxFileMb: number, uploadedKey: string | null): Promise<UploadResult> {
  const img = await processImage(data, maxFileMb * 1_048_576);
  const dupe = await db.photo.findFirst({ where: { projectId, sha256: img.sha256, deletedAt: null }, select: { code: true } });
  if (dupe) throw new ValidationError(`Already uploaded to this project as ${dupe.code}.`);

  const now = new Date();
  const base = `photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  const storageKey = uploadedKey ?? `${base}.${img.ext}`;
  const thumbKey = img.thumbnail ? `${base}.thumb.jpg` : null;
  if (!uploadedKey) await storage().put(storageKey, data, img.mimeType);
  if (img.thumbnail && thumbKey) await storage().put(thumbKey, img.thumbnail, "image/jpeg");

  const photo = await transaction(async (tx) => {
    const code = await nextCode(tx, "EV", 6);
    const row = await tx.photo.create({
      data: {
        ...meta,
        tags: meta.tags ?? [],
        code,
        projectId,
        takenAt: img.takenAt,
        uploadedById: actor.id,
        uploadedByName: actor.name,
        storageKey,
        thumbKey,
        originalName: name,
        mimeType: img.mimeType,
        sizeBytes: data.length,
        width: img.width,
        height: img.height,
        sha256: img.sha256,
      },
    });
    await recordEvent(tx, actor, "photo.upload", "Photo", row.id, { summary: `${code} ${name}`, after: { ...meta, sha256: img.sha256 } });
    return row;
  });
  return { name, ok: true, id: photo.id, code: photo.code, takenAt: img.takenAt, previewAvailable: !!thumbKey };
}

export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "heif"] as const;

/** Key for a browser-direct upload; tied to the project like project files. */
export function photoUploadKeyBelongsTo(key: string, projectId: string) {
  return new RegExp(`^photo-uploads/${projectId}/[0-9a-f-]{36}\\.(${PHOTO_EXTENSIONS.join("|")})$`).test(key);
}

/** Record a photo the browser uploaded straight to storage (Vercel Blob). */
export async function registerUploadedPhoto(actor: Actor, projectId: string, key: string, fileName: string, rawMeta: PhotoMeta): Promise<UploadResult> {
  assertCan(actor, "photo.upload");
  const limits = await getSetting("uploadLimits");
  const meta = photoMetaInput.parse(rawMeta);
  found(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }), "Project");
  await assertLinksInProject(db, projectId, meta);
  if (!photoUploadKeyBelongsTo(key, projectId)) throw new ValidationError("Upload does not belong to this project.");
  if (await db.photo.findFirst({ where: { storageKey: key }, select: { id: true } })) throw new ValidationError("This upload is already recorded.");
  let data: Buffer;
  try {
    data = await storage().get(key);
  } catch {
    throw new ValidationError("Uploaded photo not found. Try again.");
  }
  try {
    return await storePhoto(actor, projectId, meta, fileName.slice(0, 200) || "photo", data, limits.maxFileMb, key);
  } catch (err) {
    // Not recorded (not an image, duplicate, too large): the stray upload is not evidence.
    await storage().remove(key).catch(() => undefined);
    throw err;
  }
}

export interface PhotoFilter {
  projectId?: string | null;
  unitId?: string | null;
  category?: string | null;
  stage?: string | null;
  reviewStatus?: ReviewStatus | null;
  q?: string | null;
  from?: Date | null;
  to?: Date | null;
  sort?: "taken" | "uploaded";
  take?: number;
  skip?: number;
}

export function photoWhere(f: PhotoFilter): Prisma.PhotoWhereInput {
  return {
    deletedAt: null,
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.unitId ? { unitId: f.unitId } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.stage ? { stage: f.stage } : {}),
    ...(f.reviewStatus ? { reviewStatus: f.reviewStatus } : {}),
    ...(f.from || f.to ? { OR: [{ takenAt: dateRange(f.from, f.to) }, { takenAt: null, uploadedAt: dateRange(f.from, f.to) }] } : {}),
    ...(f.q
      ? {
          AND: [
            {
              OR: [
                { code: { contains: f.q, mode: "insensitive" } },
                { caption: { contains: f.q, mode: "insensitive" } },
                { description: { contains: f.q, mode: "insensitive" } },
                { heatNumber: { contains: f.q, mode: "insensitive" } },
                { weldRef: { contains: f.q, mode: "insensitive" } },
                { componentRef: { contains: f.q, mode: "insensitive" } },
                { originalName: { contains: f.q, mode: "insensitive" } },
                { tags: { has: f.q } },
              ],
            },
          ],
        }
      : {}),
  };
}

export async function listPhotos(actor: Actor, f: PhotoFilter) {
  assertCan(actor, "records.view");
  const where = photoWhere(f);
  const orderBy: Prisma.PhotoOrderByWithRelationInput[] =
    f.sort === "taken" ? [{ takenAt: { sort: "desc", nulls: "last" } }, { uploadedAt: "desc" }] : [{ uploadedAt: "desc" }];
  const [rows, total] = await Promise.all([
    db.photo.findMany({
      where,
      orderBy,
      take: f.take ?? 60,
      skip: f.skip ?? 0,
      include: { project: { select: { code: true, name: true } }, unit: { select: { ref: true } } },
    }),
    db.photo.count({ where }),
  ]);
  return { rows, total };
}

export async function getPhoto(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const photo = found(
    await db.photo.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, ref: true } },
        inspection: { select: { id: true, code: true } },
        ncr: { select: { id: true, code: true } },
        weld: { select: { id: true, weldRef: true } },
        material: { select: { id: true, code: true } },
        repair: { select: { id: true, code: true } },
      },
    }),
    "Photo",
  );
  const history = await db.auditEvent.findMany({ where: { entityType: "Photo", entityId: id }, orderBy: { at: "desc" } });
  return { photo, history };
}

export async function updatePhotoMeta(actor: Actor, id: string, raw: Partial<PhotoMeta>) {
  assertCan(actor, "photo.edit");
  const input = photoMetaInput.partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.photo.findUnique({ where: { id } }), "Photo");
    if (before.reviewStatus === "APPROVED" && !actor.permissions.has("photo.review")) {
      throw new ValidationError("This photo has been approved. Only a reviewer can change its details.");
    }
    await assertLinksInProject(tx, before.projectId, input);
    const photo = await tx.photo.update({ where: { id }, data: input });
    const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "photo.edit", "Photo", id, { summary: before.code, before: d.before, after: d.after });
    return photo;
  });
}

export async function reviewPhoto(actor: Actor, id: string, status: ReviewStatus, note?: string) {
  assertCan(actor, "photo.review");
  return transaction(async (tx) => {
    const before = found(await tx.photo.findUnique({ where: { id } }), "Photo");
    const photo = await tx.photo.update({ where: { id }, data: { reviewStatus: status, reviewedById: actor.id, reviewedAt: new Date() } });
    await recordEvent(tx, actor, "photo.review", "Photo", id, { summary: `${before.code} → ${status}${note ? ` (${note})` : ""}`, before: { reviewStatus: before.reviewStatus }, after: { reviewStatus: status } });
    return photo;
  });
}

/** Withdraw a photo from registers and reports. The original file and the
 *  record are kept for traceability. */
export async function withdrawPhoto(actor: Actor, id: string, reason: string) {
  assertCan(actor, "photo.review");
  if (!reason.trim()) throw new ValidationError("A reason is required to withdraw evidence.");
  return transaction(async (tx) => {
    const before = found(await tx.photo.findUnique({ where: { id } }), "Photo");
    await tx.photo.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordEvent(tx, actor, "photo.withdraw", "Photo", id, { summary: `${before.code}: ${reason}` });
  });
}

/** Copy chosen AI draft fields into the record. Only fields a person picks
 *  are applied, and the audit trail records that they came from the AI. */
export async function applyAiSuggestion(actor: Actor, id: string, fields: ("caption" | "description" | "category" | "observedCondition")[]) {
  assertCan(actor, "photo.edit");
  const photo = found(await db.photo.findUnique({ where: { id } }), "Photo");
  const s = photo.aiSuggestion as Record<string, unknown> | null;
  if (!s) throw new ValidationError("There is no AI suggestion for this photo.");
  const data: Record<string, string> = {};
  for (const f of fields) {
    const key = f === "observedCondition" ? "possibleObservations" : f;
    const v = s[key];
    if (typeof v === "string" && v) data[f] = v;
    if (Array.isArray(v) && v.length) data[f] = `Possible (unconfirmed): ${v.join("; ")}`;
  }
  return transaction(async (tx) => {
    const updated = await tx.photo.update({ where: { id }, data });
    await recordEvent(tx, actor, "photo.ai_applied", "Photo", id, { summary: `${photo.code}: applied AI draft (${fields.join(", ")}) — accepted by ${actor.name}`, after: data });
    return updated;
  });
}

/** Required evidence categories with no photo yet, per project. */
export async function missingEvidence(projectId: string, required: string[]) {
  if (required.length === 0) return [];
  const have = await db.photo.groupBy({ by: ["category"], where: { projectId, deletedAt: null, reviewStatus: { not: "REJECTED" } }, _count: true });
  const set = new Set(have.map((h) => h.category));
  return required.filter((c) => !set.has(c));
}
