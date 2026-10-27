import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { keyBelongsToProject, listProjectFiles, newFileKey, registerUploadedFile, removeProjectFile, uploadProjectFiles } from "@/lib/services/files";
import { createProject, createUnit } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

const pdf = (text = "drawing") => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);

async function setup() {
  const qc = await makeActor("QC_INSPECTOR");
  const p = await createProject(qc, { name: "Files test" });
  return { qc, p };
}

describe("project files", () => {
  it("stores files byte-for-byte with category, code and audit, and lists them", async () => {
    const { qc, p } = await setup();
    const u = await createUnit(qc, { projectId: p.id, ref: "M-01", type: "MODULE" });
    const res = await uploadProjectFiles(qc, p.id, [{ name: "GA Rev C.pdf", data: pdf() }, { name: "PO 4411.xlsx", data: Buffer.from("PK\u0003\u0004 xlsx") }], { category: "Drawing", unitId: u.id, notes: "IFC" });
    expect(res.every((r) => r.ok)).toBe(true);
    const rows = await listProjectFiles(qc, p.id);
    expect(rows.map((r) => r.code).sort()).toEqual(["FL-000001", "FL-000002"]);
    const ga = rows.find((r) => r.fileName === "GA Rev C.pdf")!;
    expect(ga).toMatchObject({ category: "Drawing", unitId: u.id, notes: "IFC", mimeType: "application/pdf", uploadedByName: qc.name });
    expect((await storage().get(ga.storageKey)).equals(pdf())).toBe(true);
    expect(await db.auditEvent.count({ where: { action: "file.upload" } })).toBe(2);
  });

  it("rejects disallowed types, empty files and duplicates per file without failing the batch", async () => {
    const { qc, p } = await setup();
    await uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf("a") }], { category: "Other" });
    const res = await uploadProjectFiles(qc, p.id, [
      { name: "run.exe", data: Buffer.from("MZ") },
      { name: "empty.pdf", data: Buffer.alloc(0) },
      { name: "again.pdf", data: pdf("a") },
      { name: "b.dwg", data: Buffer.from("AC1032") },
    ], { category: "Other" });
    expect(res.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(res[0]).toMatchObject({ error: expect.stringMatching(/not allowed/) });
    expect(res[2]).toMatchObject({ error: expect.stringMatching(/FL-000001/) });
  });

  it("requires a valid category and keeps modules within the project", async () => {
    const { qc, p } = await setup();
    const other = await createProject(qc, { name: "Other" });
    const foreign = await createUnit(qc, { projectId: other.id, ref: "X-1", type: "MODULE" });
    await expect(uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Nope" as never })).rejects.toThrow();
    await expect(uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other", unitId: foreign.id })).rejects.toThrow(/different project/);
  });

  it("enforces permissions: viewers cannot upload, inspectors cannot remove", async () => {
    const { qc, p } = await setup();
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(uploadProjectFiles(viewer, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other" })).rejects.toThrow();
    const [r] = await uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other" });
    await expect(removeProjectFile(qc, (r as { id: string }).id, "wrong project")).rejects.toThrow();
    expect(await listProjectFiles(viewer, p.id)).toHaveLength(1);
  });

  it("removal needs a reason, hides the file, keeps record and bytes, and allows re-upload", async () => {
    const { qc, p } = await setup();
    const qm = await makeActor("QUALITY_MANAGER");
    const [r] = await uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other" });
    const id = (r as { id: string }).id;
    await expect(removeProjectFile(qm, id, "  ")).rejects.toThrow(/reason/);
    await removeProjectFile(qm, id, "Superseded by Rev D");
    expect(await listProjectFiles(qm, p.id)).toHaveLength(0);
    const kept = (await listProjectFiles(qm, p.id, { includeRemoved: true }))[0];
    expect(kept).toMatchObject({ removeReason: "Superseded by Rev D", removedByName: qm.name });
    expect(await storage().exists(kept.storageKey)).toBe(true);
    const [again] = await uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other" });
    expect(again.ok).toBe(true);
  });

  it("registers a browser-direct upload only under its own project's key", async () => {
    const { qc, p } = await setup();
    const other = await createProject(qc, { name: "Other" });
    const key = newFileKey(p.id, "cert.pdf");
    expect(keyBelongsToProject(key, p.id)).toBe(true);
    expect(keyBelongsToProject(key, other.id)).toBe(false);
    await storage().put(key, pdf("cert"), "application/pdf");
    await expect(registerUploadedFile(qc, other.id, { key, fileName: "cert.pdf", category: "Material certificate" })).rejects.toThrow(/does not belong/);
    const row = await registerUploadedFile(qc, p.id, { key, fileName: "3.1 cert.pdf", category: "Material certificate" });
    expect(row).toMatchObject({ code: "FL-000001", sizeBytes: pdf("cert").length, storageKey: key });
    await expect(registerUploadedFile(qc, p.id, { key, fileName: "cert.pdf", category: "Material certificate" })).rejects.toThrow(/already recorded/);
  });

  it("removes a direct upload that is a duplicate instead of recording it", async () => {
    const { qc, p } = await setup();
    await uploadProjectFiles(qc, p.id, [{ name: "a.pdf", data: pdf() }], { category: "Other" });
    const key = newFileKey(p.id, "a.pdf");
    await storage().put(key, pdf(), "application/pdf");
    await expect(registerUploadedFile(qc, p.id, { key, fileName: "a.pdf", category: "Other" })).rejects.toThrow(/Already attached/);
    expect(await storage().exists(key)).toBe(false);
  });
});
