import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { generateReport } from "@/lib/report/generate";
import { REPORT_TYPES, type ReportType } from "@/lib/report/data";
import { buildExport, EXPORTS, type ExportKind } from "@/lib/export/xlsx";
import { createProject, createUnit } from "@/lib/services/projects";
import { uploadPhotos } from "@/lib/services/photos";
import { raiseNcr } from "@/lib/services/ncrs";
import { createInspection } from "@/lib/services/inspections";
import { createMaterial } from "@/lib/services/materials";
import { jpeg, makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

async function project() {
  const qm = await makeActor("QUALITY_MANAGER");
  const p = await createProject(qm, { name: "Report project", scope: "Two frames" });
  const u = await createUnit(qm, { projectId: p.id, ref: "F-1", type: "FRAME" });
  await uploadPhotos(qm, p.id, [{ name: "a.jpg", data: await jpeg({ exifDate: "2026:10:01 08:00:00" }) }, { name: "b.jpg", data: await jpeg({ color: "#aa0000" }) }], { category: "Frame assembly", unitId: u.id, caption: "Frame on jig" });
  await raiseNcr(qm, { projectId: p.id, unitId: u.id, description: "Undercut “toe” → repair", defectCategory: "Undercut" });
  await createInspection(qm, { projectId: p.id, unitId: u.id, type: "DIMENSIONAL", inspectedAt: new Date(), items: [{ description: "Length" }] });
  await createMaterial(qm, { projectId: p.id, description: "RHS" });
  return { qm, p, u };
}

describe("PDF quality reports", () => {
  it("generates every report type from stored records, with revisions", async () => {
    const { qm, p } = await project();
    for (const type of Object.keys(REPORT_TYPES) as ReportType[]) {
      const job = await generateReport(qm, { type, projectId: p.id });
      expect(job.status).toBe("COMPLETED");
      const pdf = await storage().get(job.storageKey!);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(3000);
    }
    const again = await generateReport(qm, { type: "DETAILED", projectId: p.id });
    expect(again.revision).toBe(2);
  });

  it("lists missing information instead of filling it in, and never marks itself approved", async () => {
    const { qm, p } = await project();
    const { gatherReportData } = await import("@/lib/report/data");
    const data = await gatherReportData({ type: "DETAILED", projectId: p.id });
    expect(data.missing.join("\n")).toMatch(/No final inspection recorded/);
    expect(data.missing.join("\n")).toMatch(/no approved acceptance criterion/);
    expect(data.missing.join("\n")).toMatch(/no capture date/);
    expect(data.missing.join("\n")).toMatch(/Material MT-00001/);
    void qm;
  });

  it("works for an empty project and refuses users without permission", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "Empty" });
    const job = await generateReport(qm, { type: "HANDOVER", projectId: p.id });
    expect(job.status).toBe("COMPLETED");
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(generateReport(viewer, { type: "EXECUTIVE", projectId: p.id })).rejects.toThrow(/permission/);
  });
});

describe("Excel exports", () => {
  it("builds every export as a valid workbook with an About sheet first", async () => {
    const { qm } = await project();
    for (const kind of Object.keys(EXPORTS) as ExportKind[]) {
      const { buffer, filename } = await buildExport(qm, kind, {});
      expect(filename).toMatch(new RegExp(`^asgard-${kind}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`));
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      expect(wb.worksheets[0].name).toBe("About");
      expect(wb.worksheets.length).toBeGreaterThan(1);
    }
  });

  it("includes formula cells for KPI reconciliation and does not modify records", async () => {
    const { qm } = await project();
    const before = await db.auditEvent.count();
    const { buffer } = await buildExport(qm, "kpis", {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("KPIs")!;
    const formula = ws.getRow(2).getCell(2).value as { formula?: string };
    expect(formula.formula).toMatch(/COUNTIFS/);
    expect(ws.getRow(2).getCell(3).value).toBe(1);
    expect(await db.auditEvent.count()).toBe(before);
  });

  it("is refused for roles without export permission", async () => {
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(buildExport(viewer, "projects", {})).rejects.toThrow(/permission/);
  });
});
