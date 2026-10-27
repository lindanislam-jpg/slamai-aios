import type { InspectionType } from "@prisma/client";
import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * Reads an ASGARD QF 6.42-style inspection workbook (one sheet per section,
 * numbered "Check:" rows answered Conforming Y/N) and turns each section into
 * a checklist template definition.
 *
 * Nothing is invented: check wording, numbering and responsible role come from
 * the workbook. Rows whose text cannot be read are reported as warnings, not
 * guessed. Templates created from this are unapproved until a Quality Manager
 * approves them in Settings.
 */

export interface ParsedItem {
  no: string;
  description: string;
  requirement: string;
  unit?: string;
  group?: string;
  role?: string;
  required: boolean;
}

export interface ParsedSection {
  sheet: string;
  title: string;
  formCode: string | null;
  revision: string | null;
  inspectionType: InspectionType;
  items: ParsedItem[];
  warnings: string[];
}

const SKIP_SHEETS = [/^front\s*pg/i, /^weld map/i, /^ncs?\s*&\s*sign/i];
const ROLES = ["Saw Operator", "Fabricators", "Fabricator", "Welders", "Welder", "Gen Op", "General Ops", "Painter", "Contractor"];

const cellText = (v: ExcelJS.CellValue): string | null => {
  if (v == null) return null;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result == null ? null : String(v.result);
    if ("text" in v) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }
  return String(v);
};

const clean = (s: string) =>
  s
    .replace(/\(_{3,}\s*mm\)\s*(Fabricator|RWC)\.?/gi, "")
    .replace(/_{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;:,]\s*$/, (m) => (m.trim() === ":" ? ":" : ""));

const isCheckNo = (s: string | null) => !!s && /^\d{1,2}(\.\d{1,2}[a-z]?)?$/i.test(s.trim());

function typeFor(sheet: string): InspectionType {
  if (/paint/i.test(sheet)) return "COATING";
  if (/^ndt/i.test(sheet)) return "NDT";
  if (/final assembly/i.test(sheet)) return "INTERMEDIATE";
  if (/site install|containment|unistrut/i.test(sheet)) return "OTHER";
  return "FABRICATION";
}

/** exceljs cannot read some workbooks with embedded drawings (weld maps).
 *  Drawings are irrelevant to the checklist, so drop them before parsing. */
export async function withoutDrawings(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      // Also drop merge definitions: some forms keep check text in a cell that
      // is (wrongly) inside a merge, and merges would hide it behind the number.
      zip.file(name, xml.replace(/<(legacyDrawing|drawing) [^>]*\/>/g, "").replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/g, ""));
    } else if (/^xl\/worksheets\/_rels\/.*\.rels$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<Relationship [^>]*Type="[^"]*\/(drawing|vmlDrawing)"[^>]*\/>/g, ""));
    } else if (/^xl\/drawings\//.test(name)) zip.remove(name);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function parseInspectionWorkbook(buf: Buffer): Promise<ParsedSection[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await withoutDrawings(buf)) as unknown as ArrayBuffer);
  const out: ParsedSection[] = [];

  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim();
    if (SKIP_SHEETS.some((r) => r.test(sheet))) continue;
    const section: ParsedSection = { sheet, title: sheet, formCode: null, revision: null, inspectionType: typeFor(sheet), items: [], warnings: [] };
    let group: string | undefined;
    const seen = new Set<string>();
    let prevNo: string | null = null;

    ws.eachRow((row) => {
      // Use the displayed text for numbers so "3.10" is not read as 3.1.
      const cells = (row.values as ExcelJS.CellValue[]).slice(1).map((v, i) => (typeof v === "number" ? row.getCell(i + 1).text || cellText(v) : cellText(v)));
      const texts = cells.filter((c): c is string => !!c && c.trim() !== "").map((c) => c.trim());
      if (!texts.length) return;

      for (const t of texts) {
        if (!section.formCode && /^QF\s?\d+\.\d+[a-z]?$/i.test(t)) section.formCode = t.replace(/\s+/g, " ");
        if (!section.revision && /^Rev\s*\.?\s*\d+/i.test(t)) section.revision = t.replace(/\s+/g, "");
      }
      const sectionTitle = texts.find((t) => /^Section\b/i.test(t));
      if (sectionTitle) {
        section.title = clean(sectionTitle);
        return;
      }
      if (texts.some((t) => /^(No|Check:?)$/i.test(t))) return;

      // Number: prefer column B when it looks like a check number (some sheets
      // carry an old number in column A), else column A.
      let no = isCheckNo(cells[1]) ? cells[1]!.trim() : isCheckNo(cells[0]) ? cells[0]!.trim() : null;
      // Numbers stored as decimals lose trailing zeros (3.10 → 3.1). If the
      // sequence just passed x.9, read x.1 as x.10, x.2 as x.20 …
      if (no && prevNo) {
        const [maj, min] = no.split(".");
        const [pMaj, pMin] = prevNo.split(".");
        if (maj === pMaj && min && /^\d$/.test(min) && pMin && parseInt(pMin, 10) >= 9) no = `${maj}.${min}0`;
      }
      const text = texts.find((t) => !isCheckNo(t) && t.length > 3 && !ROLES.includes(t) && !/^QF/i.test(t));
      const distinct = new Set(texts);

      if (!no) {
        // A row repeating one word across merged cells is a group heading.
        if (distinct.size === 1 && text && text.length < 60 && !/report|drawing|signature|project|standard/i.test(text)) group = clean(text);
        return;
      }
      if (!text) {
        section.warnings.push(`${no}: check text could not be read from the workbook — review against the paper form.`);
        return;
      }
      prevNo = no;
      const key = `${no}|${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      if ([...seen].some((k) => k.startsWith(`${no}|`) && k !== key)) section.warnings.push(`${no}: number used more than once in this section.`);
      const role = [...texts].reverse().find((t) => ROLES.some((r) => r.toLowerCase() === t.toLowerCase()));
      const dimensional = /exact (opposite )?.*dimension measured|dimension measured/i.test(text);
      const recordOnly = /:\s*$/.test(text.trim()) || /number:?$/i.test(text.trim());
      const formRef = `${section.formCode ?? "QF 6.42"}${section.revision ? ` ${section.revision}` : ""} §${no}`;
      section.items.push({
        no,
        description: `${no} ${clean(text)}`,
        requirement: dimensional
          ? `${formRef}: record the measured value (fabricator and RWC) and compare with the IFC drawing. Tolerance is not stated on this form.`
          : recordOnly
            ? `${formRef}: record the value.`
            : `${formRef}: conforming Y/N.`,
        unit: dimensional ? "mm" : undefined,
        group,
        role: role?.replace(/s$/, ""),
        required: true,
      });
    });
    if (section.items.length) out.push(section);
  }
  return out;
}
