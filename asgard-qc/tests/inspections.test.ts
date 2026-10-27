import { beforeEach, describe, expect, it } from "vitest";
import { approveTemplate, createInspection, listInspections, reviewInspection, saveChecklist, saveTemplate, submissionProblems, submitInspection, updateInspection } from "@/lib/services/inspections";
import { createProject, createUnit } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("inspections", () => {
  it("flags checklist items without approved criteria instead of inventing them", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "x" });
    const i = await createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", items: [{ description: "Length", requirement: "Per DWG-1 rev B" }, { description: "Squareness" }] });
    expect(i.items.map((x) => x.criteriaStatus)).toEqual(["DEFINED", "REQUIRES_CONFIGURATION"]);
  });

  it("will not submit without a result, a date and answered required items, and never PASS with a failed item", () => {
    const base = { result: "PASS" as const, inspectedAt: new Date(), items: [{ description: "a", result: "FAIL" as const, required: true }] };
    expect(submissionProblems(base)).toEqual(["Overall result cannot be Pass while a required checklist item failed."]);
    expect(submissionProblems({ ...base, result: "PENDING", inspectedAt: null, items: [{ description: "a", result: "PENDING", required: true }] })).toHaveLength(3);
  });

  it("enforces segregation of duties and locks reviewed records", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "x" });
    const i = await createInspection(qm, { projectId: p.id, type: "FINAL", inspectedAt: new Date(), items: [{ description: "Visual", result: "PASS" }] });
    await updateInspection(qm, i.id, { result: "PASS" });
    await submitInspection(qm, i.id);
    await expect(reviewInspection(qm, i.id, "ACCEPTED")).rejects.toThrow(/cannot review an inspection you recorded/);
    await expect(reviewInspection(qc, i.id, "ACCEPTED")).rejects.toThrow(/permission/);
    const qm2 = await makeActor("QUALITY_MANAGER");
    await expect(reviewInspection(qm2, i.id, "REJECTED")).rejects.toThrow(/reason/);
    await reviewInspection(qm2, i.id, "ACCEPTED");
    await expect(updateInspection(qm, i.id, { comments: "late edit" })).rejects.toThrow(/no longer be edited/);
    await expect(saveChecklist(qm, i.id, [])).rejects.toThrow(/locked/);
    void qc;
  });

  it("filters by project, frame, type and result", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "x" });
    const u = await createUnit(qc, { projectId: p.id, ref: "F-9", type: "FRAME" });
    await createInspection(qc, { projectId: p.id, unitId: u.id, type: "WELD_VISUAL", result: "FAIL" });
    await createInspection(qc, { projectId: p.id, type: "FINAL" });
    expect(await listInspections(qc, { unitId: u.id })).toHaveLength(1);
    expect(await listInspections(qc, { type: "FINAL" })).toHaveLength(1);
    expect(await listInspections(qc, { result: "FAIL" })).toHaveLength(1);
    expect(await listInspections(qc, { q: "f-9" })).toHaveLength(1);
  });

  it("copies template items into new inspections so later template edits do not rewrite history", async () => {
    const admin = await makeActor("ADMIN");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "x" });
    const t = await saveTemplate(admin, null, { name: "Frame check", inspectionType: "DIMENSIONAL", items: [{ description: "Diagonal", requirement: "Per DWG", required: true }] });
    await approveTemplate(admin, t.id);
    const i = await createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", templateId: t.id });
    await saveTemplate(admin, t.id, { name: "Frame check", inspectionType: "DIMENSIONAL", items: [{ description: "Changed", required: true }] });
    const items = (await listInspections(qc, {}))[0];
    expect(items._count.items).toBe(1);
    expect(i.items[0].description).toBe("Diagonal");
  });
});
