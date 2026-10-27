import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { computeKpis, inspectionKpis } from "@/lib/kpi";
import { createProject } from "@/lib/services/projects";
import { createInspection } from "@/lib/services/inspections";
import { raiseNcr } from "@/lib/services/ncrs";
import { recordRework } from "@/lib/services/ncrs";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("KPI maths", () => {
  it("separates pass rate from first-pass yield and excludes N/A, drafts and cancelled records", () => {
    const r = (result: string, status: string, re: string | null = null) => ({ result, status, reinspectionOfId: re }) as Parameters<typeof inspectionKpis>[0][number];
    const k = inspectionKpis([
      r("PASS", "ACCEPTED"),
      r("FAIL", "ACCEPTED"),
      r("PASS", "ACCEPTED", "x"), // re-inspection: counts for pass rate, not FPY
      r("NA", "SUBMITTED"),
      r("PASS", "DRAFT"),
      r("FAIL", "CANCELLED"),
      r("HOLD", "SUBMITTED"),
    ]);
    expect(k.total).toBe(6);
    expect(k.completed).toBe(5);
    expect(k.pending).toBe(1);
    expect(k.passRateBasis).toEqual({ numerator: 2, denominator: 4 });
    expect(k.passRate).toBe(0.5);
    expect(k.fpyBasis).toEqual({ numerator: 1, denominator: 3 });
    expect(k.firstPassYield).toBeCloseTo(1 / 3);
  });

  it("returns null (not 0% or 100%) for empty datasets", async () => {
    const k = inspectionKpis([]);
    expect(k.passRate).toBeNull();
    expect(k.firstPassYield).toBeNull();
    const all = await computeKpis({ from: new Date(0), to: new Date() });
    expect(all.inspections.total).toBe(0);
    expect(all.trend).toEqual([]);
    expect(all.rework.actualCost).toBeNull();
  });
});

describe("KPI reconciliation with records", () => {
  it("matches counts queried independently from the database", async () => {
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "KPI" });
    const now = new Date();
    for (const [result, status] of [["PASS", "ACCEPTED"], ["PASS", "SUBMITTED"], ["FAIL", "ACCEPTED"], ["PENDING", "DRAFT"]] as const) {
      const i = await createInspection(qc, { projectId: p.id, type: "FABRICATION", inspectedAt: now });
      await db.inspection.update({ where: { id: i.id }, data: { result, status } });
    }
    const overdue = await createInspection(qc, { projectId: p.id, type: "FINAL", plannedDate: new Date(Date.now() - 3 * 86_400_000) });
    void overdue;
    const n = await raiseNcr(qc, { projectId: p.id, description: "x", defectCategory: "Dimensional", targetDate: new Date(Date.now() - 86_400_000) });
    void n;
    await recordRework(qc, { projectId: p.id, description: "a", cost: 100 });
    await recordRework(qc, { projectId: p.id, description: "b", cost: 50, costIsEstimate: true });
    await recordRework(qc, { projectId: p.id, description: "c" });

    const k = await computeKpis({ from: new Date(Date.now() - 7 * 86_400_000), to: new Date(Date.now() + 60_000), projectId: p.id });
    const dbTotal = await db.inspection.count({ where: { projectId: p.id, status: { not: "CANCELLED" } } });
    expect(k.inspections.total).toBe(dbTotal);
    expect(k.inspections.passRate).toBeCloseTo(2 / 3);
    expect(k.inspections.overdue).toBe(1);
    expect(k.ncrs).toEqual({ open: 1, overdue: 1 });
    expect(k.rework.volume).toBe(3);
    expect(k.rework.actualCost).toBe(100);
    expect(k.rework.estimatedCost).toBe(50);
    expect(k.rework.costedRecords).toBe(1);
  });
});
