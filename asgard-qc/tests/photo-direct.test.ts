import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { photoUploadKeyBelongsTo, registerUploadedPhoto } from "@/lib/services/photos";
import { createProject } from "@/lib/services/projects";
import { jpeg, makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

const keyFor = (projectId: string, ext = "jpg") => `photo-uploads/${projectId}/${randomUUID()}.${ext}`;

describe("browser-direct photo uploads", () => {
  it("records a directly uploaded photo in place with EXIF time and thumbnail", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "Direct" });
    const key = keyFor(p.id);
    const data = await jpeg({ exifDate: "2026:10:20 09:15:00", w: 1600 });
    await storage().put(key, data, "image/jpeg");
    const r = await registerUploadedPhoto(qc, p.id, key, "IMG_0042.jpg", { category: "Frame assembly", caption: "Jig" });
    expect(r).toMatchObject({ ok: true, code: "EV-000001", previewAvailable: true });
    const row = await db.photo.findFirstOrThrow();
    expect(row).toMatchObject({ storageKey: key, originalName: "IMG_0042.jpg", caption: "Jig", sizeBytes: data.length });
    expect(row.takenAt?.toISOString()).toBe("2026-10-20T09:15:00.000Z");
    expect(await storage().exists(row.thumbKey!)).toBe(true);
    expect(await db.auditEvent.count({ where: { action: "photo.upload" } })).toBe(1);
  });

  it("only accepts keys issued under the same project, once", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "A" });
    const other = await createProject(qc, { name: "B" });
    const key = keyFor(p.id);
    expect(photoUploadKeyBelongsTo(key, p.id)).toBe(true);
    expect(photoUploadKeyBelongsTo(key, other.id)).toBe(false);
    expect(photoUploadKeyBelongsTo(`photo-uploads/${p.id}/${randomUUID()}.exe`, p.id)).toBe(false);
    await storage().put(key, await jpeg(), "image/jpeg");
    await expect(registerUploadedPhoto(qc, other.id, key, "a.jpg", { category: "Frame assembly" })).rejects.toThrow(/does not belong/);
    await registerUploadedPhoto(qc, p.id, key, "a.jpg", { category: "Frame assembly" });
    await expect(registerUploadedPhoto(qc, p.id, key, "a.jpg", { category: "Frame assembly" })).rejects.toThrow(/already recorded/);
  });

  it("deletes uploads that are not images or are duplicates instead of recording them", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "A" });
    const bad = keyFor(p.id);
    await storage().put(bad, Buffer.from("not an image"), "image/jpeg");
    await expect(registerUploadedPhoto(qc, p.id, bad, "x.jpg", { category: "Frame assembly" })).rejects.toThrow(/JPG, PNG and HEIC/);
    expect(await storage().exists(bad)).toBe(false);
    const img = await jpeg({ color: "#123456" });
    const first = keyFor(p.id);
    await storage().put(first, img, "image/jpeg");
    await registerUploadedPhoto(qc, p.id, first, "a.jpg", { category: "Frame assembly" });
    const again = keyFor(p.id);
    await storage().put(again, img, "image/jpeg");
    await expect(registerUploadedPhoto(qc, p.id, again, "a.jpg", { category: "Frame assembly" })).rejects.toThrow(/EV-000001/);
    expect(await storage().exists(again)).toBe(false);
    expect(await db.photo.count()).toBe(1);
  });

  it("requires photo.upload", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const viewer = await makeActor("PRODUCTION_VIEWER");
    const p = await createProject(qc, { name: "A" });
    await expect(registerUploadedPhoto(viewer, p.id, keyFor(p.id), "a.jpg", { category: "Frame assembly" })).rejects.toThrow();
  });
});
