import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildExport } from "@/lib/export/xlsx";
import { saveTemplate } from "@/lib/services/inspections";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("QM review pack", () => {
  it("lists templates, every check, release rules and permissions without changing anything", async () => {
    const admin = await makeActor("ADMIN");
    await saveTemplate(admin, null, { name: "QF 9.99 — Section 1", inspectionType: "FABRICATION", documentRef: "QF 9.99 Rev.1", items: [{ description: "1.1 Right steel?", requirement: "QF 9.99 §1.1: conforming Y/N.", required: true }, { description: "1.2 Length", required: true }] });
    const before = await db.auditEvent.count();
    const { buffer } = await buildExport(admin, "templates", {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["About", "Templates", "Checks", "Release rules", "Role permissions"]);
    expect(wb.getWorksheet("Templates")!.getRow(2).getCell(5).value).toBe("Not approved");
    const checks = wb.getWorksheet("Checks")!;
    expect(checks.rowCount).toBe(3);
    expect(checks.getRow(3).getCell(4).value).toBe("Requires configuration");
    expect(await db.auditEvent.count()).toBe(before);
  });
});
