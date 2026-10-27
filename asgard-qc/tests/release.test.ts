import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { authoriseRelease, evaluateRelease, revokeRelease, type ReleaseContext } from "@/lib/services/release";
import { createProject, createUnit } from "@/lib/services/projects";
import { createInspection, reviewInspection, submitInspection, updateInspection } from "@/lib/services/inspections";
import { createWeld, recordVisual } from "@/lib/services/welding";
import { uploadPhotos } from "@/lib/services/photos";
import { jpeg, makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

const ok: ReleaseContext = { inspections: [{ id: "i1", code: "INS-1", type: "FINAL", status: "ACCEPTED", result: "PASS", reinspectionOfId: null }], ncrs: [], materials: [], welds: [], ndt: [], photoCategories: ["Final inspection", "Completed module"], holdPoints: [] };

describe("release rules (pure)", () => {
  it("passes a complete record and fails each gap", () => {
    const rules = SETTING_DEFAULTS.releaseRules;
    expect(evaluateRelease(ok, rules).every((c) => c.state !== "FAIL")).toBe(true);
    const bad = evaluateRelease({ ...ok, ncrs: [{ code: "NCR-1", status: "OPEN", actions: [] }], welds: [{ weldRef: "W1", status: "REPAIR_REQUIRED" }], ndt: [{ code: "NDT-1", result: "PENDING" }], materials: [{ code: "MT-1", status: "QUARANTINED", certStatus: "MISSING" }], photoCategories: [] }, rules);
    expect(bad.filter((c) => c.state === "FAIL").map((c) => c.key).sort()).toEqual(["certs", "evidence", "materials", "ncrs", "ndt", "welds"]);
  });

  it("treats a failed inspection as resolved only by an accepted passing re-inspection", () => {
    const rules = SETTING_DEFAULTS.releaseRules;
    const failed = { ...ok, inspections: [...ok.inspections, { id: "i2", code: "INS-2", type: "FABRICATION", status: "ACCEPTED", result: "FAIL", reinspectionOfId: null }] };
    expect(evaluateRelease(failed, rules).find((c) => c.key === "inspections")!.state).toBe("FAIL");
    const fixed = { ...failed, inspections: [...failed.inspections, { id: "i3", code: "INS-3", type: "FABRICATION", status: "ACCEPTED", result: "PASS", reinspectionOfId: "i2" }] };
    expect(evaluateRelease(fixed, rules).find((c) => c.key === "inspections")!.state).toBe("PASS");
  });

  it("can switch individual rules off", () => {
    const rules = { ...SETTING_DEFAULTS.releaseRules, requireNdtComplete: false };
    const r = evaluateRelease({ ...ok, ndt: [{ code: "NDT-1", result: "PENDING" }] }, rules);
    expect(r.find((c) => c.key === "ndt")!.state).toBe("NOT_REQUIRED");
  });
});

describe("release workflow", () => {
  async function project() {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR");
    const wi = await makeActor("WELDING_INSPECTOR");
    const p = await createProject(qm, { name: "Release test" });
    const u = await createUnit(qm, { projectId: p.id, ref: "M-1", type: "MODULE" });
    return { qm, qc, wi, p, u };
  }

  it("blocks release while checks fail, allows a documented concession only to authorised users, and can be revoked", async () => {
    const { qm, qc, wi, p, u } = await project();
    const w = await createWeld(wi, { projectId: p.id, unitId: u.id, weldRef: "W1" });
    await recordVisual(wi, w.id, { visualResult: "FAIL" });

    await expect(authoriseRelease(qc, { projectId: p.id, unitId: u.id })).rejects.toThrow(/permission/);
    await expect(authoriseRelease(qm, { projectId: p.id, unitId: u.id })).rejects.toThrow(/Release blocked/);
    const r = await authoriseRelease(qm, { projectId: p.id, unitId: u.id, concessionRef: "CON-001", concessionReason: "Customer-approved deviation" });
    expect(r.status).toBe("RELEASED_WITH_CONCESSION");
    expect((r.checks as { state: string }[]).some((c) => c.state === "FAIL")).toBe(true);
    expect((await db.unit.findUniqueOrThrow({ where: { id: u.id } })).released).toBe(true);
    await expect(authoriseRelease(qm, { projectId: p.id, unitId: u.id, concessionRef: "x", concessionReason: "y" })).rejects.toThrow(/Already released/);
    await revokeRelease(qm, r.id, "Concession withdrawn");
    expect((await db.unit.findUniqueOrThrow({ where: { id: u.id } })).released).toBe(false);
    void qc;
  });

  it("refuses concessions when the rules disable them", async () => {
    const { qm, p } = await project();
    await db.setting.create({ data: { key: "releaseRules", value: { ...SETTING_DEFAULTS.releaseRules, allowConcession: false } } });
    await expect(authoriseRelease(qm, { projectId: p.id, concessionRef: "C", concessionReason: "R" })).rejects.toThrow(/Release blocked/);
  });

  it("releases cleanly when every check passes", async () => {
    const { qm, qc, p, u } = await project();
    const i = await createInspection(qc, { projectId: p.id, unitId: u.id, type: "FINAL", inspectedAt: new Date(), items: [{ description: "Visual", requirement: "Per ITP", result: "PASS" }] });
    await updateInspection(qc, i.id, { result: "PASS" });
    await submitInspection(qc, i.id);
    await reviewInspection(qm, i.id, "ACCEPTED");
    for (const [cat, color] of [["Final inspection", "#123456"], ["Completed module", "#654321"]]) await uploadPhotos(qc, p.id, [{ name: "x.jpg", data: await jpeg({ color }) }], { category: cat, unitId: u.id });
    const r = await authoriseRelease(qm, { projectId: p.id, unitId: u.id });
    expect(r.status).toBe("RELEASED");
    expect(r.concessionRef).toBeNull();
  });
});
