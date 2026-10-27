import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseInspectionWorkbook } from "@/lib/import/qf-form";
import { resetDb } from "./helpers";

beforeEach(resetDb);

/** Synthetic workbook shaped like a QF 6.42 section — no company content. */
async function workbook() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Front Pg").addRow(["Inspection Report", "QF 9.99"]);
  const ws = wb.addWorksheet("Frames ");
  ws.addRow([null, null, null, "Test Inspection Report", null, null, "QF 9.99a", "Rev .3"]);
  ws.addRow(["Section 1 – Frame QC Checks"]);
  ws.addRow(["No", "Check:", null, null, null, "Conforming (Y/N):", "Initial & Date:"]);
  ws.addRow(["Cutting", "Cutting", "Cutting"]);
  ws.addRow([1.1, "Is the right section being cut?", null, null, null, null, "Saw Operator"]);
  for (let i = 2; i <= 9; i++) ws.addRow([Number(`1.${i}`), `Check number ${i}?`, null, null, null, null, "Fabricator"]);
  ws.addRow([1.1, "Confirm the overall length. Exact dimension measured to be written here; (_____________mm) Fabricator", null, null, null, null, "Fabricators"]);
  ws.addRow(["Welding", "Welding"]);
  ws.addRow(["1.11", "Welding wire number:", null, null, null, null, "Welder"]);
  ws.addRow(["1.12", null, null, null, null, null, "Welder"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("inspection form import", () => {
  it("turns a section into checklist items without inventing anything", async () => {
    const [s, ...rest] = await parseInspectionWorkbook(await workbook());
    expect(rest).toHaveLength(0); // front page skipped
    expect(s.title).toBe("Section 1 – Frame QC Checks");
    expect(s.formCode).toBe("QF 9.99a");
    expect(s.revision).toBe("Rev.3");
    expect(s.items[0]).toMatchObject({ no: "1.1", group: "Cutting", role: "Saw Operator", requirement: "QF 9.99a Rev.3 §1.1: conforming Y/N." });
    // A numeric 1.1 after 1.9 is the form's 1.10.
    const dim = s.items.find((i) => i.no === "1.10")!;
    expect(dim.unit).toBe("mm");
    expect(dim.description).toBe("1.10 Confirm the overall length. Exact dimension measured to be written here");
    expect(dim.requirement).toMatch(/Tolerance is not stated on this form/);
    expect(s.items.find((i) => i.no === "1.11")).toMatchObject({ group: "Welding", requirement: expect.stringMatching(/record the value/) });
    // A numbered row with no text is reported, not guessed.
    expect(s.items.find((i) => i.no === "1.12")).toBeUndefined();
    expect(s.warnings).toEqual(["1.12: check text could not be read from the workbook — review against the paper form."]);
  });
});
