import { beforeEach, describe, expect, it } from "vitest";
import { raiseNcrsForFailedInspections } from "@/lib/automation";
import { db } from "@/lib/db";
import { cancelInspection, createInspection } from "@/lib/services/inspections";
import { raiseNcr } from "@/lib/services/ncrs";
import { createProject } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

describe("raising NCRs for every inspection that recorded a problem", () => {
  beforeEach(resetDb);

  it("raises one NCR per failed inspection without one, copies the problem, skips cancelled and already-covered ones, and changes nothing on a re-run", async () => {
    const qm = await makeActor("QUALITY_MANAGER", "Quality Lead");
    const p = await createProject(qm, { name: "Kiosk", code: "AMM425" });
    const mk = (extra = {}) => createInspection(qm, { projectId: p.id, type: "INCOMING_MATERIAL", result: "PENDING", inspectedAt: new Date("2025-07-16T12:00:00Z"), ...extra });
    const dent = await mk({ result: "FAIL", comments: "Supplier: Greenspan\\nInspection 9 records Small Dent", items: [{ description: "Inspection 9 (photo check)", actual: "Small Dent", result: "FAIL" }] });
    const itemOnly = await mk({ items: [{ description: "Bolts", actual: "wrong side", result: "FAIL" }] });
    const fine = await mk({ result: "PASS" });
    const cancelled = await mk({ result: "FAIL" });
    await cancelInspection(qm, cancelled.id, "duplicate");
    const covered = await mk({ result: "FAIL" });
    await raiseNcr(qm, { projectId: p.id, inspectionId: covered.id, defectCategory: "Material", description: "already raised", priority: "MEDIUM" });

    const r = await raiseNcrsForFailedInspections(qm);
    expect(r.raised.map((x) => x.inspection).sort()).toEqual([dent.code, itemOnly.code].sort());
    const ncr = await db.ncr.findFirstOrThrow({ where: { inspectionId: dent.id } });
    expect(ncr).toMatchObject({ status: "OPEN", priority: "MEDIUM", raisedByName: "Quality Lead", projectId: p.id });
    expect(ncr.description).toMatch(/Small Dent/);
    expect(ncr.description).toMatch(/2025-07-16/);
    expect(await db.ncr.count({ where: { inspectionId: fine.id } })).toBe(0);
    expect(await db.ncr.count({ where: { inspectionId: cancelled.id } })).toBe(0);
    expect((await raiseNcrsForFailedInspections(qm)).raised).toHaveLength(0);
    await expect(raiseNcrsForFailedInspections(await makeActor("AUDITOR"))).rejects.toThrow();
  });
});
