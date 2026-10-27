import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getPhoto, listPhotos, reviewPhoto, updatePhotoMeta, uploadPhotos, withdrawPhoto } from "@/lib/services/photos";
import { createProject, createUnit } from "@/lib/services/projects";
import { raiseNcr } from "@/lib/services/ncrs";
import { jpeg, makeActor, png, resetDb } from "./helpers";
import { TEST_DATABASE_URL } from "./env";

beforeEach(resetDb);

async function setup() {
  const qc = await makeActor("QC_INSPECTOR");
  const p = await createProject(qc, { name: "Photo test" });
  const u = await createUnit(qc, { projectId: p.id, ref: "F-1", type: "FRAME" });
  return { qc, p, u };
}

describe("photo evidence", () => {
  it("uploads a batch, keeps originals byte-for-byte and records EXIF capture time only when present", async () => {
    const { qc, p, u } = await setup();
    const withExif = await jpeg({ exifDate: "2026:09:14 07:45:00", color: "#112233" });
    const noExif = await png();
    const res = await uploadPhotos(qc, p.id, [{ name: "a.jpg", data: withExif }, { name: "b.png", data: noExif }], { category: "Frame assembly", unitId: u.id, caption: "Jig", tags: "jig, frame" });
    expect(res.every((r) => r.ok)).toBe(true);
    const rows = await db.photo.findMany({ orderBy: { code: "asc" } });
    expect(rows.map((r) => r.code)).toEqual(["EV-000001", "EV-000002"]);
    expect(rows[0].takenAt?.toISOString()).toBe("2026-09-14T07:45:00.000Z");
    expect(rows[1].takenAt).toBeNull(); // never back-filled with upload time
    expect(rows[0].tags).toEqual(["jig", "frame"]);
    const stored = await storage().get(rows[0].storageKey);
    expect(stored.equals(withExif)).toBe(true);
    expect(await storage().exists(rows[0].thumbKey!)).toBe(true);
  });

  it("rejects invalid, oversized, empty and duplicate files individually without failing the batch", async () => {
    const { qc, p } = await setup();
    await db.setting.create({ data: { key: "uploadLimits", value: { maxFileMb: 0.01, maxFilesPerBatch: 10 } } });
    const small = await jpeg({ w: 32 });
    const big = await jpeg({ w: 3000 });
    const res = await uploadPhotos(qc, p.id, [
      { name: "ok.jpg", data: small },
      { name: "evil.jpg", data: Buffer.from("<script>alert(1)</script>") },
      { name: "huge.jpg", data: Buffer.concat([big, Buffer.alloc(20_000)]) },
      { name: "empty.jpg", data: Buffer.alloc(0) },
      { name: "again.jpg", data: small },
    ], { category: "General quality evidence" });
    expect(res.map((r) => r.ok)).toEqual([true, false, false, false, false]);
    expect(res[1]).toMatchObject({ error: expect.stringMatching(/Only JPG, PNG and HEIC/) });
    expect(res[2]).toMatchObject({ error: expect.stringMatching(/larger than/) });
    expect(res[4]).toMatchObject({ error: expect.stringMatching(/Already uploaded/) });
    expect(await db.photo.count()).toBe(1);
  });

  it("refuses to link evidence to a record from another project", async () => {
    const { qc, p } = await setup();
    const other = await createProject(qc, { name: "Other" });
    const otherUnit = await createUnit(qc, { projectId: other.id, ref: "X-1", type: "FRAME" });
    await expect(uploadPhotos(qc, p.id, [{ name: "a.jpg", data: await jpeg() }], { category: "Frame assembly", unitId: otherUnit.id })).rejects.toThrow(/different project/);
  });

  it("does not let viewers upload", async () => {
    const { p } = await setup();
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(uploadPhotos(viewer, p.id, [{ name: "a.jpg", data: await jpeg() }], { category: "Frame assembly" })).rejects.toThrow(/permission/);
  });

  it("keeps an audit history of metadata edits, locks approved photos to reviewers, and withdraws without deleting", async () => {
    const { qc, p } = await setup();
    const qm = await makeActor("QUALITY_MANAGER");
    const [r] = await uploadPhotos(qc, p.id, [{ name: "a.jpg", data: await jpeg() }], { category: "Frame assembly" });
    if (!r.ok) throw new Error(r.error);
    await updatePhotoMeta(qc, r.id, { caption: "First", category: "Frame assembly" });
    await updatePhotoMeta(qc, r.id, { caption: "Second", category: "Frame assembly" });
    const { history } = await getPhoto(qc, r.id);
    const edits = history.filter((h) => h.action === "photo.edit");
    expect(edits).toHaveLength(2);
    expect(edits[0].before).toMatchObject({ caption: "First" });
    expect(edits[0].after).toMatchObject({ caption: "Second" });

    await reviewPhoto(qm, r.id, "APPROVED");
    await expect(updatePhotoMeta(qc, r.id, { caption: "Third", category: "Frame assembly" })).rejects.toThrow(/approved/);

    await withdrawPhoto(qm, r.id, "Wrong project");
    expect((await listPhotos(qc, { projectId: p.id })).total).toBe(0);
    const row = await db.photo.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(await storage().exists(row.storageKey)).toBe(true);
  });

  it("filters by category, unit and text, and survives a fresh database connection (persistence)", async () => {
    const { qc, p, u } = await setup();
    await uploadPhotos(qc, p.id, [{ name: "a.jpg", data: await jpeg({ color: "#010203" }) }], { category: "Welding in progress", unitId: u.id, heatNumber: "H-777" });
    await uploadPhotos(qc, p.id, [{ name: "b.jpg", data: await jpeg({ color: "#040506" }) }], { category: "Final inspection" });
    expect((await listPhotos(qc, { category: "Welding in progress" })).total).toBe(1);
    expect((await listPhotos(qc, { unitId: u.id })).total).toBe(1);
    expect((await listPhotos(qc, { q: "h-777" })).total).toBe(1);
    const fresh = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    expect(await fresh.photo.count({ where: { projectId: p.id } })).toBe(2);
    await fresh.$disconnect();
  });

  it("uploading a repair photo does not close the NCR it is linked to", async () => {
    const { qc, p } = await setup();
    const ncr = await raiseNcr(qc, { projectId: p.id, description: "Undercut", defectCategory: "Undercut" });
    await uploadPhotos(qc, p.id, [{ name: "after.jpg", data: await jpeg() }], { category: "Repair & rework — after", ncrId: ncr.id, reworkPhase: "AFTER" });
    expect((await db.ncr.findUniqueOrThrow({ where: { id: ncr.id } })).status).toBe("OPEN");
  });
});
