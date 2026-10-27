import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createProject, createUnit } from "@/lib/services/projects";
import { addDefect, confirmDefect, createWeld, deriveWeldStatus, recordVisual, recordWeldRepair, weldAnalytics } from "@/lib/services/welding";
import { saveNdt } from "@/lib/services/ndt-coating";
import { computeKpis } from "@/lib/kpi";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("weld status derivation", () => {
  it("is derived from visual, NDT and repair state", () => {
    expect(deriveWeldStatus({ visualResult: "PASS", ndtRequired: false, ndtResults: [], openRepairAwaitingReinspection: false })).toBe("ACCEPTED");
    expect(deriveWeldStatus({ visualResult: "PASS", ndtRequired: true, ndtResults: [], openRepairAwaitingReinspection: false })).toBe("AWAITING_INSPECTION");
    expect(deriveWeldStatus({ visualResult: "PASS", ndtRequired: true, ndtResults: ["ACCEPT"], openRepairAwaitingReinspection: false })).toBe("ACCEPTED");
    expect(deriveWeldStatus({ visualResult: "PASS", ndtRequired: true, ndtResults: ["REJECT"], openRepairAwaitingReinspection: false })).toBe("REPAIR_REQUIRED");
    expect(deriveWeldStatus({ visualResult: "FAIL", ndtRequired: false, ndtResults: [], openRepairAwaitingReinspection: false })).toBe("REPAIR_REQUIRED");
    expect(deriveWeldStatus({ visualResult: "PENDING", ndtRequired: false, ndtResults: [], openRepairAwaitingReinspection: true })).toBe("AWAITING_REINSPECTION");
  });
});

describe("welding QC", () => {
  it("tracks fail → repair → re-inspection, which needs an authorised inspector", async () => {
    const wi = await makeActor("WELDING_INSPECTOR");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(await makeActor("QUALITY_MANAGER"), { name: "Weld test" });
    const u = await createUnit(await makeActor("QUALITY_MANAGER"), { projectId: p.id, ref: "F-1", type: "FRAME" });
    const w = await createWeld(wi, { projectId: p.id, unitId: u.id, weldRef: "F-1-W1", wpsRef: "WPS-1", welderId: "WLD-7" });
    expect(await recordVisual(wi, w.id, { visualResult: "FAIL" })).toBe("REPAIR_REQUIRED");
    await addDefect(wi, w.id, { category: "Undercut" });
    await recordWeldRepair(wi, w.id, { description: "Ground and re-welded", hours: 1.5 });
    expect((await db.weld.findUniqueOrThrow({ where: { id: w.id } })).status).toBe("AWAITING_REINSPECTION");
    // QC inspector cannot even record weld results; welding inspector can re-inspect.
    await expect(recordVisual(qc, w.id, { visualResult: "PASS" })).rejects.toThrow(/permission/);
    expect(await recordVisual(wi, w.id, { visualResult: "PASS" })).toBe("ACCEPTED");
    const repair = await db.repair.findFirstOrThrow({ where: { weldId: w.id } });
    expect(repair.reinspectionResult).toBe("PASS");
    expect(repair.reinspectedBy).toBe(wi.name);
  });

  it("keeps AI-suggested defects unconfirmed and out of KPIs until an inspector confirms", async () => {
    const wi = await makeActor("WELDING_INSPECTOR");
    const p = await createProject(await makeActor("QUALITY_MANAGER"), { name: "x" });
    const w = await createWeld(wi, { projectId: p.id, weldRef: "W1" });
    const d = await addDefect(wi, w.id, { category: "Porosity", source: "AI_SUGGESTION" });
    expect(d.confirmed).toBe(false);
    const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 60_000) };
    expect((await computeKpis(range)).weldDefects.total).toBe(0);
    expect((await weldAnalytics()).total).toBe(0);
    await confirmDefect(wi, d.id, true);
    expect((await computeKpis(range)).weldDefects.total).toBe(1);
    expect((await weldAnalytics()).pareto).toEqual([{ key: "Porosity", count: 1 }]);
  });

  it("holds an NDT-required weld until the report is accepted, and needs a report number for any result", async () => {
    const wi = await makeActor("WELDING_INSPECTOR");
    const p = await createProject(await makeActor("QUALITY_MANAGER"), { name: "x" });
    const w = await createWeld(wi, { projectId: p.id, weldRef: "W1", ndtRequired: true });
    expect(await recordVisual(wi, w.id, { visualResult: "PASS" })).toBe("AWAITING_INSPECTION");
    await expect(saveNdt(wi, null, { projectId: p.id, weldId: w.id, method: "UT", requestedAt: new Date(), result: "ACCEPT" })).rejects.toThrow(/report number/);
    const n = await saveNdt(wi, null, { projectId: p.id, weldId: w.id, method: "UT", requestedAt: new Date() });
    await saveNdt(wi, n.id, { projectId: p.id, weldId: w.id, method: "UT", requestedAt: new Date(), reportNo: "UT-1", result: "ACCEPT" });
    expect((await db.weld.findUniqueOrThrow({ where: { id: w.id } })).status).toBe("ACCEPTED");
  });

  it("finds repeat defects by welder and frame", async () => {
    const wi = await makeActor("WELDING_INSPECTOR");
    const p = await createProject(await makeActor("QUALITY_MANAGER"), { name: "x" });
    const u = await createUnit(await makeActor("QUALITY_MANAGER"), { projectId: p.id, ref: "F-2", type: "FRAME" });
    for (const ref of ["W1", "W2"]) {
      const w = await createWeld(wi, { projectId: p.id, unitId: u.id, weldRef: ref, welderId: "WLD-1" });
      await addDefect(wi, w.id, { category: "Undercut" });
    }
    const a = await weldAnalytics(p.id);
    expect(a.repeats.map((r) => r.key).sort()).toEqual([`Frame ${p.code}/F-2 — Undercut`, "Welder WLD-1 — Undercut"].sort());
  });
});
