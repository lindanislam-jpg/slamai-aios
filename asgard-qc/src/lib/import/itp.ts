import type { ControlPointType } from "@prisma/client";
import ExcelJS from "exceljs";
import { withoutDrawings } from "./qf-form";

/**
 * Reads an ASGARD Inspection & Test Plan workbook (QF 6.14 layout): one sheet
 * per discipline, a header row starting "Item | Inspection Activity", section
 * rows like "2.0 WELDING", and H/W/I/R/M/S/A codes per party.
 * Columns are located by their header text, so column order may change.
 */

export interface ParsedControlPoint {
  itemNo: string;
  section: string | null;
  activity: string;
  acceptanceCriteria: string | null;
  method: string | null;
  frequency: string | null;
  extent: string | null;
  responsibility: string | null;
  signoffDocument: string | null;
  verifyingDocument: string | null;
  subPoint: string | null;
  pointType: ControlPointType | null;
  clientPoint: string | null;
  thirdPartyPoint: string | null;
}

export interface ParsedItp {
  discipline: string;
  documentRef: string | null;
  points: ParsedControlPoint[];
  warnings: string[];
}

const CODES = new Set(["H", "W", "I", "R", "M", "S", "A"]);

const text = (v: ExcelJS.CellValue): string | null => {
  if (v == null) return null;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim() || null;
    if ("result" in v) return v.result == null ? null : String(v.result).trim() || null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }
  return String(v).trim() || null;
};

const HEADERS: [keyof ParsedControlPoint | "item", RegExp][] = [
  ["item", /^item$/i],
  ["activity", /inspection activity|^activity/i],
  ["acceptanceCriteria", /acceptance criteria|procedure/i],
  ["method", /method/i],
  ["frequency", /frequency/i],
  ["extent", /^%$|extent/i],
  ["responsibility", /responsib/i],
  ["signoffDocument", /sign.?off doc/i],
  ["verifyingDocument", /verifying doc/i],
  ["subPoint", /^sub$/i],
  ["pointType", /^amm$/i],
  ["clientPoint", /^client$/i],
  ["thirdPartyPoint", /3rd|third/i],
];

export async function parseItpWorkbook(buf: Buffer): Promise<ParsedItp[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await withoutDrawings(buf)) as unknown as ArrayBuffer);
  const out: ParsedItp[] = [];
  for (const ws of wb.worksheets) {
    const itp: ParsedItp = { discipline: ws.name.trim(), documentRef: null, points: [], warnings: [] };
    let cols: Partial<Record<string, number>> | null = null;
    let section: string | null = null;
    ws.eachRow((row) => {
      const cells = (row.values as ExcelJS.CellValue[]).slice(1).map(text);
      const nonEmpty = cells.filter(Boolean) as string[];
      if (!nonEmpty.length) return;
      if (!itp.documentRef) {
        const doc = nonEmpty.find((c) => /Doc:\s*QF/i.test(c));
        if (doc) itp.documentRef = doc.replace(/Doc:\s*/i, "").replace(/\s+/g, " ").replace(/\s*Rev:\s*/i, " Rev ");
      }
      if (!cols) {
        if (/^item$/i.test(cells[0] ?? "") && cells.some((c) => c && /activity/i.test(c))) {
          cols = {};
          cells.forEach((c, i) => {
            if (!c) return;
            const hit = HEADERS.find(([key, re]) => re.test(c) && cols![key] == null);
            if (hit) cols![hit[0]] = i;
          });
        }
        return;
      }
      const c = cols as Record<string, number | undefined>;
      const item = cells[c.item ?? 0];
      // A row repeating one text across merged cells is a section heading
      // ("2.0 WELDING", "Cable Containment (Trays, Trunking…)").
      if (item && new Set(nonEmpty).size === 1 && !/^\d+(\.\d+)?[a-z]?$/i.test(item)) {
        section = item.replace(/\s+/g, " ").trim();
        return;
      }
      if (!item || !/^\d+(\.\d+)?[a-z]?$/i.test(item)) return;
      const get = (k: string) => (c[k] != null ? cells[c[k]!] ?? null : null);
      const activity = get("activity");
      if (!activity) {
        itp.warnings.push(`Item ${item}: no inspection activity text.`);
        return;
      }
      const amm = get("pointType")?.toUpperCase() ?? null;
      if (amm && !CODES.has(amm)) itp.warnings.push(`Item ${item}: unknown AMM control code "${amm}" kept as blank.`);
      itp.points.push({
        itemNo: item,
        section,
        activity,
        acceptanceCriteria: get("acceptanceCriteria"),
        method: get("method"),
        frequency: get("frequency"),
        extent: get("extent"),
        responsibility: get("responsibility"),
        signoffDocument: get("signoffDocument"),
        verifyingDocument: get("verifyingDocument"),
        subPoint: get("subPoint"),
        pointType: amm && CODES.has(amm) ? (amm as ControlPointType) : null,
        clientPoint: get("clientPoint"),
        thirdPartyPoint: get("thirdPartyPoint"),
      });
    });
    if (itp.points.length) out.push(itp);
  }
  return out;
}
