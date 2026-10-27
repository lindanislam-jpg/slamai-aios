import { ProjectStatus, UnitType } from "@prisma/client";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "../db";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { assertCan } from "../services/base";
import { createProject, createUnit, projectCode } from "../services/projects";
import { optDate, optStr, reqStr } from "../validation";

/**
 * Project register import from Excel: sheet "Projects" (one row per project)
 * and optional sheet "Units" (modules / frames / components). Columns are
 * matched by header text. Existing projects and units are never changed —
 * they are reported as skipped.
 */

const PROJECT_COLS: Record<string, RegExp> = {
  code: /project (number|no|code)|^code$/i,
  name: /project name|^name$/i,
  customerRef: /client|customer/i,
  status: /status/i,
  startDate: /start/i,
  targetDate: /target|completion|delivery/i,
  projectManager: /manager|^pm$/i,
  departments: /department/i,
  drawingRefs: /drawing/i,
  scope: /scope/i,
  description: /description|notes/i,
  requirements: /requirement|itp|specification/i,
};

const UNIT_COLS: Record<string, RegExp> = {
  projectCode: /project/i,
  ref: /unit ref|^ref|reference|unit$/i,
  type: /type/i,
  parentRef: /parent/i,
  description: /description/i,
  drawingRef: /drawing/i,
  revision: /rev/i,
  stage: /stage/i,
};

const projectRow = z.object({
  code: projectCode.refine((v) => !!v, "Project number is required"),
  name: reqStr(200),
  customerRef: optStr(200),
  status: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().replace(/[\s-]+/g, "_") : undefined), z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_RELEASE", "CLOSED", "CANCELLED"] as [ProjectStatus, ...ProjectStatus[]]).optional()),
  startDate: optDate,
  targetDate: optDate,
  projectManager: optStr(200),
  departments: optStr(400),
  drawingRefs: optStr(2000),
  scope: optStr(4000),
  description: optStr(4000),
  requirements: optStr(4000),
});

const unitRow = z.object({
  projectCode: projectCode.refine((v) => !!v, "Project number is required"),
  ref: reqStr(60),
  type: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "FRAME"), z.nativeEnum(UnitType)),
  parentRef: optStr(60),
  description: optStr(1000),
  drawingRef: optStr(200),
  revision: optStr(40),
  stage: optStr(120),
});

const cellValue = (c: ExcelJS.Cell): unknown => {
  const v = c.value;
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result instanceof Date ? v.result.toISOString().slice(0, 10) : v.result;
    if ("text" in v) return v.text;
    return null;
  }
  return typeof v === "number" ? String(v) : v;
};

function readSheet(ws: ExcelJS.Worksheet | undefined, map: Record<string, RegExp>) {
  if (!ws) return [];
  const header = ws.getRow(1);
  const cols: Record<string, number> = {};
  header.eachCell((cell, col) => {
    const t = String(cellValue(cell) ?? "").trim();
    const key = Object.entries(map).find(([k, re]) => re.test(t) && cols[k] == null)?.[0];
    if (key) cols[key] = col;
  });
  const rows: { row: number; data: Record<string, unknown> }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const data: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(cols)) data[k] = cellValue(row.getCell(col));
    if (Object.values(data).some((v) => v != null && String(v).trim() !== "")) rows.push({ row: n, data });
  });
  return rows;
}

export interface ImportPreview {
  projects: { row: number; code: string; name: string; action: "create" | "skip"; reason?: string }[];
  units: { row: number; projectCode: string; ref: string; action: "create" | "skip"; reason?: string }[];
  errors: string[];
}

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ValidationError("The file could not be read as an Excel workbook (.xlsx).");
  }
  const find = (re: RegExp) => wb.worksheets.find((w) => re.test(w.name.trim()));
  const projects = readSheet(find(/^projects?$/i) ?? wb.worksheets[0], PROJECT_COLS);
  const units = readSheet(find(/^(units|modules|frames)/i), UNIT_COLS);
  return { projects, units };
}

/** Validate and (when apply = true) create. Nothing is written in preview. */
export async function importProjects(actor: Actor, buf: Buffer, apply: boolean): Promise<ImportPreview> {
  assertCan(actor, "project.write");
  const { projects, units } = await load(buf);
  const out: ImportPreview = { projects: [], units: [], errors: [] };
  const parsedProjects: z.output<typeof projectRow>[] = [];
  const seen = new Set<string>();

  for (const { row, data } of projects) {
    const r = projectRow.safeParse(data);
    if (!r.success) {
      out.errors.push(`Projects row ${row}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const code = r.data.code!;
    if (seen.has(code)) {
      out.errors.push(`Projects row ${row}: ${code} appears more than once.`);
      continue;
    }
    seen.add(code);
    const exists = await db.project.findUnique({ where: { code } });
    out.projects.push({ row, code, name: r.data.name, action: exists ? "skip" : "create", reason: exists ? "already exists — not changed" : undefined });
    if (!exists) parsedProjects.push(r.data);
  }

  const parsedUnits: (z.output<typeof unitRow> & { row: number })[] = [];
  const unitKeys = new Set<string>();
  for (const { row, data } of units) {
    const r = unitRow.safeParse(data);
    if (!r.success) {
      out.errors.push(`Units row ${row}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const pc = r.data.projectCode!;
    const key = `${pc}|${r.data.ref}`;
    if (unitKeys.has(key)) {
      out.errors.push(`Units row ${row}: ${r.data.ref} listed twice for ${pc}.`);
      continue;
    }
    unitKeys.add(key);
    const project = await db.project.findUnique({ where: { code: pc } });
    if (!project && !seen.has(pc)) {
      out.errors.push(`Units row ${row}: project ${pc} is not in the register or the Projects sheet.`);
      continue;
    }
    const exists = project ? await db.unit.findUnique({ where: { projectId_ref: { projectId: project.id, ref: r.data.ref } } }) : null;
    out.units.push({ row, projectCode: pc, ref: r.data.ref, action: exists ? "skip" : "create", reason: exists ? "already exists — not changed" : undefined });
    if (!exists) parsedUnits.push({ ...r.data, row });
  }
  for (const u of parsedUnits) {
    if (u.parentRef && !parsedUnits.some((x) => x.projectCode === u.projectCode && x.ref === u.parentRef)) {
      const project = await db.project.findUnique({ where: { code: u.projectCode! } });
      const parent = project ? await db.unit.findUnique({ where: { projectId_ref: { projectId: project.id, ref: u.parentRef } } }) : null;
      if (!parent) out.errors.push(`Units row ${u.row}: parent ${u.parentRef} not found for ${u.projectCode}.`);
    }
  }

  if (!apply) return out;
  if (out.errors.length) throw new ValidationError(`Fix ${out.errors.length} problem(s) in the file before importing.`);

  for (const p of parsedProjects) {
    const { status, ...rest } = p;
    const created = await createProject(actor, rest);
    if (status && status !== "PLANNED") await db.project.update({ where: { id: created.id }, data: { status } });
  }
  // Parents first, then children.
  const ordered = [...parsedUnits].sort((a, b) => Number(!!a.parentRef) - Number(!!b.parentRef));
  for (const u of ordered) {
    const project = await db.project.findUniqueOrThrow({ where: { code: u.projectCode! } });
    const parent = u.parentRef ? await db.unit.findUnique({ where: { projectId_ref: { projectId: project.id, ref: u.parentRef } } }) : null;
    await createUnit(actor, { projectId: project.id, ref: u.ref, type: u.type, parentId: parent?.id, description: u.description, drawingRef: u.drawingRef, revision: u.revision, stage: u.stage });
  }
  return out;
}

/** Blank import workbook with the expected headers and one example row. */
export async function projectImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const p = wb.addWorksheet("Projects");
  p.addRow(["Project number", "Project name", "Client", "Status", "Start date", "Target completion", "Project manager", "Departments", "Drawing refs", "Scope", "Description", "Requirements / ITP"]);
  p.addRow(["EXAMPLE-001", "Delete this example row", "Client name", "Active", "2026-01-15", "2026-03-30", "Name", "Fabrication, Quality", "DWG-001 Rev A", "What is being built", "", "QF 6.14 Rev 3"]);
  const u = wb.addWorksheet("Units");
  u.addRow(["Project number", "Unit ref", "Type", "Parent ref", "Description", "Drawing ref", "Revision", "Stage"]);
  u.addRow(["EXAMPLE-001", "M-01", "Module", "", "Delete this example row", "DWG-001", "A", ""]);
  u.addRow(["EXAMPLE-001", "M-01-F1", "Frame", "M-01", "Base frame", "DWG-002", "B", "Fabrication"]);
  const notes = wb.addWorksheet("Notes");
  for (const line of [
    "Status: Planned, Active, On hold, Awaiting release, Closed or Cancelled. Release is recorded in the app, never imported.",
    "Type: Module, Frame or Component. Parent ref links a frame to its module.",
    "Existing projects and units are skipped, never overwritten.",
    "Dates: YYYY-MM-DD or Excel dates.",
  ])
    notes.addRow([line]);
  for (const ws of [p, u]) {
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 20));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
