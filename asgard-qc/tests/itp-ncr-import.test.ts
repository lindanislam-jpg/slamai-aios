import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseItpWorkbook } from "@/lib/import/itp";
import { importProjects } from "@/lib/import/projects";
import { applyItp, markNotApplicable, signControlPoint } from "@/lib/services/itp";
import { closeNcr, moveNcr, raiseNcr, recordEffectiveness, updateNcr } from "@/lib/services/ncrs";
import { createProject } from "@/lib/services/projects";
import { releaseReadiness } from "@/lib/services/release";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

/** Synthetic ITP shaped like QF 6.14 — no company content. */
async function itpWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Cover").addRow(["Cover sheet"]);
  const ws = wb.addWorksheet("Structural");
  ws.addRow(["TEST ITP", null, null, null, null, null, null, null, null, "Doc: QF 9.14  Rev: 7"]);
  ws.addRow(["Item", "Inspection Activity", "Procedure / Acceptance Criteria", "Inspection Method", "Frequency", "%", "Responsibility", "Sign-off Document", "Verifying Document", "Sub", "AMM", "Client", "3rd\nParty"]);
  ws.addRow(["1.0  DOCUMENTS", "1.0  DOCUMENTS", "1.0  DOCUMENTS"]);
  ws.addRow([1, "Contract review", "Review contract", "Document Review", "At order", "N/A", "QM", "QF 1", "Contract", null, "R", "R"]);
  ws.addRow([2, "Handover pack – Hold Point", "Compile pack", "Document Review", "At completion", "N/A", "QM", "Pack", "Dossier", null, "H", "H", "H"]);
  ws.addRow(["Sub-system A", "Sub-system A"]);
  ws.addRow([3, "Visual inspection of welds", "Per approved criteria", "Visual", "100%", "100%", "QC", "QF 6.42", "Report", null, "I", "W"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("ITP import and hold points", () => {
  it("parses control points with sections and party codes", async () => {
    const [itp, ...rest] = await parseItpWorkbook(await itpWorkbook());
    expect(rest).toHaveLength(0);
    expect(itp.discipline).toBe("Structural");
    expect(itp.documentRef).toBe("QF 9.14 Rev 7");
    expect(itp.points.map((p) => [p.itemNo, p.section, p.pointType, p.clientPoint])).toEqual([
      ["1", "1.0 DOCUMENTS", "R", "R"],
      ["2", "1.0 DOCUMENTS", "H", "H"],
      ["3", "Sub-system A", "I", "W"],
    ]);
  });

  it("blocks project release until hold points are signed by an authorised person", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qm, { name: "ITP project" });
    const res = await applyItp(qm, p.id, { name: "itp.xlsx", data: await itpWorkbook() });
    expect(res).toEqual([{ discipline: "Structural", points: 3, holds: 1, warnings: [] }]);
    await expect(applyItp(qm, p.id, { name: "itp.xlsx", data: await itpWorkbook() })).rejects.toThrow(/Already applied/);

    const hold = await db.controlPoint.findFirstOrThrow({ where: { pointType: "H" } });
    const inspect = await db.controlPoint.findFirstOrThrow({ where: { pointType: "I" } });
    let r = await releaseReadiness(qm, p.id);
    expect(r.checks.find((c) => c.key === "holdpoints")!.state).toBe("FAIL");

    await expect(signControlPoint(qc, hold.id, "pack ref")).rejects.toThrow(/permission/);
    await expect(signControlPoint(qm, hold.id, "")).rejects.toThrow(/evidence/);
    await signControlPoint(qc, inspect.id, "INS-000001"); // inspectors sign I points
    await signControlPoint(qm, hold.id, "Handover dossier HD-01");
    r = await releaseReadiness(qm, p.id);
    expect(r.checks.find((c) => c.key === "holdpoints")!.state).toBe("PASS");
    await expect(markNotApplicable(qm, hold.id, "x")).rejects.toThrow(/already closed/);
  });

  it("does not apply hold points to a single module release", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "x" });
    await applyItp(qm, p.id, { name: "itp.xlsx", data: await itpWorkbook() });
    const unit = await db.unit.create({ data: { projectId: p.id, ref: "M-1", type: "MODULE" } });
    const r = await releaseReadiness(qm, p.id, unit.id);
    expect(r.checks.find((c) => c.key === "holdpoints")!.state).toBe("NOT_REQUIRED");
  });
});

describe("NCR form fields and effectiveness", () => {
  it("records severity and impact, schedules the effectiveness check, and reopens when not effective", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "x" });
    const n = await raiseNcr(qm, { projectId: p.id, description: "Missing weld", defectCategory: "Missing weld", severity: "MAJOR", department: "Fabrication", stageOfDetection: "In-process QC", containment: "Quarantined" });
    expect(n.severity).toBe("MAJOR");
    await moveNcr(qm, n.id, "INVESTIGATING");
    await updateNcr(qm, n.id, { rootCause: "Drawing not at workstation", impactStructural: "HIGH", impactSafety: "HIGH", contributingFactors: "No pre-task briefing", disposition: "Repair" });
    await moveNcr(qm, n.id, "ACTION_IN_PROGRESS");
    await moveNcr(qm, n.id, "AWAITING_VERIFICATION");
    await expect(recordEffectiveness(qm, n.id, "EFFECTIVE", "x")).rejects.toThrow(/after the NCR is closed/);
    const closed = await closeNcr(qm, n.id, { verificationNotes: "Weld completed and inspected", reinspectionResult: "PASS" });
    expect(closed.effectivenessStatus).toBe("PENDING");
    expect(Math.round((closed.effectivenessDueAt!.getTime() - closed.closedAt!.getTime()) / 86_400_000)).toBe(30);
    const qc = await makeActor("QC_INSPECTOR");
    await expect(recordEffectiveness(qc, n.id, "EFFECTIVE", "ok")).rejects.toThrow(/permission/);
    const reopened = await recordEffectiveness(qm, n.id, "NOT_EFFECTIVE", "Repeat missing weld found on skid 4");
    expect(reopened.status).toBe("ACTION_IN_PROGRESS");
    expect(reopened.closedAt).toBeNull();
    expect(reopened.effectivenessStatus).toBe("NOT_EFFECTIVE");
  });
});

describe("project import", () => {
  async function file(rows: unknown[][], units: unknown[][] = []) {
    const wb = new ExcelJS.Workbook();
    const p = wb.addWorksheet("Projects");
    p.addRow(["Project number", "Project name", "Client", "Status", "Target completion"]);
    rows.forEach((r) => p.addRow(r));
    const u = wb.addWorksheet("Units");
    u.addRow(["Project number", "Unit ref", "Type", "Parent ref", "Drawing ref", "Revision"]);
    units.forEach((r) => u.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("previews without writing, then creates projects with company numbers and units", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const buf = await file([["tst100", "Test kiosks", "Client A", "Active", "2026-06-30"]], [["TST100", "K-1", "Module", null, "DWG-1", "6"], ["TST100", "K-1-F", "Frame", "K-1", "DWG-2", "1"]]);
    const preview = await importProjects(qm, buf, false);
    expect(preview.errors).toEqual([]);
    expect(preview.projects).toEqual([{ row: 2, code: "TST100", name: "Test kiosks", action: "create" }]);
    expect(await db.project.count()).toBe(0);
    await importProjects(qm, buf, true);
    const p = await db.project.findUniqueOrThrow({ where: { code: "TST100" }, include: { units: true } });
    expect(p.status).toBe("ACTIVE");
    expect(p.units.find((u) => u.ref === "K-1-F")!.parentId).toBe(p.units.find((u) => u.ref === "K-1")!.id);
    // Second run skips everything instead of overwriting.
    const again = await importProjects(qm, buf, false);
    expect(again.projects[0].action).toBe("skip");
    expect(again.units.every((u) => u.action === "skip")).toBe(true);
  });

  it("refuses bad rows, release status and unknown projects", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const buf = await file([["TST1", "", null, "Active"], ["TST2", "Ok", null, "Released"]], [["NOPE", "X-1", "Frame"]]);
    const r = await importProjects(qm, buf, false);
    expect(r.errors).toHaveLength(3);
    await expect(importProjects(qm, buf, true)).rejects.toThrow(/Fix 3 problem/);
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(importProjects(viewer, buf, false)).rejects.toThrow(/permission/);
  });

  it("keeps project numbers unique and fixed", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    await createProject(qm, { code: "amm999", name: "x" });
    await expect(createProject(qm, { code: "AMM999", name: "y" })).rejects.toThrow(/already exists/);
    await expect(createProject(qm, { code: "bad code!", name: "y" })).rejects.toThrow(/letters, digits/);
    const auto = await createProject(qm, { name: "z" });
    expect(auto.code).toBe("PRJ-0001");
  });
});
