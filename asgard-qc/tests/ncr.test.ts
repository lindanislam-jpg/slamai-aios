import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addAction, closeNcr, closureProblems, moveNcr, raiseNcr, updateActionStatus, updateNcr } from "@/lib/services/ncrs";
import { createProject } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("NCR & CAPA lifecycle", () => {
  it("runs open → investigate → action → verify → close, and records every step", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "NCR test" });
    const ncr = await raiseNcr(qc, { projectId: p.id, description: "Porosity in weld", defectCategory: "Porosity", priority: "HIGH" });
    expect(ncr.code).toBe("NCR-0001");
    expect(ncr.status).toBe("OPEN");

    await expect(moveNcr(qm, ncr.id, "ACTION_IN_PROGRESS")).rejects.toThrow(/Cannot move/);
    await moveNcr(qm, ncr.id, "INVESTIGATING");
    await expect(moveNcr(qm, ncr.id, "ACTION_IN_PROGRESS")).rejects.toThrow(/root cause/);
    await updateNcr(qm, ncr.id, { rootCause: "Contaminated plate", rootCauseCategory: "Material", rootCauseMethod: "5 Whys" });
    await moveNcr(qm, ncr.id, "ACTION_IN_PROGRESS");
    const action = await addAction(qm, { ncrId: ncr.id, description: "Clean plate before welding" });
    await expect(moveNcr(qm, ncr.id, "AWAITING_VERIFICATION")).rejects.toThrow(/still open/);
    await updateActionStatus(qm, action.id, "COMPLETED");
    await moveNcr(qm, ncr.id, "AWAITING_VERIFICATION");

    // Not verified yet → cannot close.
    await expect(closeNcr(qm, ncr.id, { verificationNotes: "Looks fine", reinspectionResult: "PASS" })).rejects.toThrow(/verified/);
    await updateActionStatus(qm, action.id, "VERIFIED");
    await expect(closeNcr(qm, ncr.id, { verificationNotes: "Re-inspected", reinspectionResult: "FAIL" })).rejects.toThrow(/Re-inspection must pass/);
    await closeNcr(qm, ncr.id, { verificationNotes: "Re-inspected after repair", reinspectionResult: "PASS" });

    const closed = await db.ncr.findUniqueOrThrow({ where: { id: ncr.id } });
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedByName).toBe(qm.name);
    const actions = (await db.auditEvent.findMany({ where: { entityType: "Ncr", entityId: ncr.id } })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["ncr.raise", "ncr.update", "ncr.status", "ncr.close"]));
  });

  it("only users with ncr.close can close or cancel", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "x" });
    const ncr = await raiseNcr(qc, { projectId: p.id, description: "d", defectCategory: "Dimensional" });
    await expect(moveNcr(qc, ncr.id, "CANCELLED", "dup")).rejects.toThrow(/permission/);
    await expect(closeNcr(qc, ncr.id, { verificationNotes: "x", reinspectionResult: "PASS" })).rejects.toThrow(/permission/);
  });

  it("explains every reason closure is blocked", () => {
    const p = closureProblems({ status: "OPEN", rootCause: null, disposition: null, actions: [{ status: "OPEN" }], reinspectionResult: null, verificationNotes: null });
    expect(p).toHaveLength(5);
  });
});
