import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addCalibration, addRevision, approveRevision, calibrationStatus, createDocument, createEquipment } from "@/lib/services/documents";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("document control", () => {
  it("never overwrites a revision, needs a second person to approve, and supersedes the old approved revision", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qm2 = await makeActor("QUALITY_MANAGER");
    const d = await createDocument(qm, { docNo: "WPS-1", title: "WPS", docType: "WPS" });
    const pdf = Buffer.from("%PDF-1.4\n% test\n");
    const a = await addRevision(qm, d.id, { revision: "A" }, { name: "wps.pdf", data: pdf });
    await expect(addRevision(qm, d.id, { revision: "A" })).rejects.toThrow(/already exists/);
    await expect(approveRevision(qm, a.id)).rejects.toThrow(/someone other than the uploader/);
    await approveRevision(qm2, a.id);
    const b = await addRevision(qm, d.id, { revision: "B" });
    await approveRevision(qm2, b.id);
    const revs = await db.documentRevision.findMany({ where: { documentId: d.id }, orderBy: { revision: "asc" } });
    expect(revs.map((r) => r.status)).toEqual(["SUPERSEDED", "APPROVED"]);
    expect(revs[0].sha256).toHaveLength(64);
  });

  it("rejects unsupported document files", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const d = await createDocument(qm, { docNo: "X-1", title: "x", docType: "Other" });
    await expect(addRevision(qm, d.id, { revision: "1" }, { name: "x.exe", data: Buffer.from("MZ\x90\x00") })).rejects.toThrow(/PDF, PNG/);
  });
});

describe("calibration", () => {
  it("classifies status from the latest due date", async () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(calibrationStatus(null, 30, now)).toBe("NO_RECORD");
    expect(calibrationStatus(new Date("2026-05-31T00:00:00Z"), 30, now)).toBe("EXPIRED");
    expect(calibrationStatus(new Date("2026-06-20T00:00:00Z"), 30, now)).toBe("DUE_SOON");
    expect(calibrationStatus(new Date("2026-09-01T00:00:00Z"), 30, now)).toBe("CURRENT");
    const qm = await makeActor("QUALITY_MANAGER");
    const e = await createEquipment(qm, { assetNo: "TAPE-1", description: "Tape" });
    await expect(addCalibration(qm, e.id, { calibratedAt: now, dueAt: now })).rejects.toThrow(/after/);
  });
});
