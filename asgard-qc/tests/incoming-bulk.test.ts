import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bulkAcceptIncoming, createInspection } from "@/lib/services/inspections";
import { createProject } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

describe("accepting several incoming deliveries at once", () => {
  beforeEach(resetDb);

  it("passes and submits only draft incoming inspections, answering their pending lines, and reports the rest", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR", "Lindani Test");
    const p = await createProject(qm, { name: "Goods in" });
    const mk = (extra = {}) => createInspection(qc, { projectId: p.id, type: "INCOMING_MATERIAL", result: "PENDING", inspectedAt: new Date(), items: [{ description: "Inspection 1 (photo check)", actual: "32pcs", result: "PENDING" }], ...extra });
    const good = await mk();
    const failedLine = await mk({ items: [{ description: "Inspection 2", actual: "Screws showing up", result: "FAIL" }] });
    const noDate = await mk({ inspectedAt: null });
    const dims = await createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", result: "PENDING", inspectedAt: new Date() });

    const r = await bulkAcceptIncoming(qc, [good.id, failedLine.id, noDate.id, dims.id, good.id]);
    expect(r.accepted).toEqual([good.id]);
    expect(r.skipped.map((s) => s.code).sort()).toEqual([failedLine.code, noDate.code, dims.code].sort());

    const g = await db.inspection.findUniqueOrThrow({ where: { id: good.id }, include: { items: true } });
    expect(g).toMatchObject({ result: "PASS", status: "SUBMITTED" });
    expect(g.items[0]).toMatchObject({ result: "PASS", actual: "32pcs" });
    expect(g.items[0].notes).toMatch(/Accepted with the delivery by Lindani Test/);
    expect(await db.auditEvent.count({ where: { action: "inspection.bulk_accept", entityId: good.id } })).toBe(1);
    // Untouched: no partial changes on the skipped records.
    const nd = await db.inspection.findUniqueOrThrow({ where: { id: noDate.id }, include: { items: true } });
    expect(nd).toMatchObject({ result: "PENDING", status: "DRAFT" });
    expect(nd.items[0].result).toBe("PENDING");
    expect(await db.ncr.count()).toBe(0);
    // A second run changes nothing.
    expect((await bulkAcceptIncoming(qc, [good.id])).accepted).toEqual([]);
  });

  it("is refused for a role that cannot record inspections", async () => {
    const viewer = await makeActor("AUDITOR");
    await expect(bulkAcceptIncoming(viewer, ["x"])).rejects.toThrow();
  });
});
