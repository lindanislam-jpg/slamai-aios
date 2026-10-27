import { ProjectStatus, UnitType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optDate, optStr, reqStr } from "../validation";
import { ValidationError } from "../errors";
import { assertCan, found, transaction } from "./base";

/** Company project number, e.g. AMM764. Optional — a PRJ-0001 style number
 *  is issued when it is left blank. */
export const projectCode = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().toUpperCase()) : v),
  z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Project number: letters, digits and dashes only (e.g. AMM764)").optional(),
);

export const projectInput = z.object({
  code: projectCode,
  name: reqStr(200),
  customerRef: optStr(200),
  description: optStr(4000),
  scope: optStr(4000),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: optDate,
  targetDate: optDate,
  projectManager: optStr(200),
  departments: optStr(400),
  drawingRefs: optStr(2000),
  requirements: optStr(4000),
  stages: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
});
export type ProjectInput = z.input<typeof projectInput>;

export async function listProjects(actor: Actor, f: { q?: string | null; status?: ProjectStatus | null } = {}) {
  assertCan(actor, "records.view");
  const where: Prisma.ProjectWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { code: { contains: f.q, mode: "insensitive" } },
            { name: { contains: f.q, mode: "insensitive" } },
            { customerRef: { contains: f.q, mode: "insensitive" } },
            { projectManager: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { code: "desc" }],
    include: {
      _count: { select: { units: true, photos: { where: { deletedAt: null } }, inspections: true } },
      ncrs: { where: { status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true } },
    },
  });
}

export async function getProject(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  return found(
    await db.project.findUnique({
      where: { id },
      include: { units: { orderBy: { ref: "asc" } } },
    }),
    "Project",
  );
}

export async function createProject(actor: Actor, raw: ProjectInput) {
  assertCan(actor, "project.write");
  const input = projectInput.parse(raw);
  return transaction(async (tx) => {
    if (input.code && (await tx.project.findUnique({ where: { code: input.code } }))) throw new ValidationError(`Project ${input.code} already exists.`);
    const code = input.code ?? (await nextCode(tx, "PRJ", 4));
    const project = await tx.project.create({
      data: { ...input, stages: input.stages ?? [], code, createdById: actor.id },
    });
    await recordEvent(tx, actor, "project.create", "Project", project.id, { summary: `${code} ${project.name}`, after: project });
    return project;
  });
}

export async function updateProject(actor: Actor, id: string, raw: Partial<ProjectInput>) {
  assertCan(actor, "project.write");
  // The project number is an identifier used on every record and report; it
  // is fixed once created.
  const input = projectInput.omit({ code: true }).partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.project.findUnique({ where: { id } }), "Project");
    if (input.status === "RELEASED" && before.status !== "RELEASED") {
      throw new Error("Projects are released through Final Inspection & Release, not by editing the status.");
    }
    const project = await tx.project.update({ where: { id }, data: input });
    const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "project.update", "Project", id, { summary: before.code, before: d.before, after: d.after });
    return project;
  });
}

export const unitInput = z.object({
  projectId: reqStr(),
  ref: reqStr(60),
  type: z.nativeEnum(UnitType),
  parentId: optStr(60),
  description: optStr(1000),
  drawingRef: optStr(200),
  revision: optStr(40),
  stage: optStr(120),
});

export async function createUnit(actor: Actor, raw: z.input<typeof unitInput>) {
  assertCan(actor, "project.write");
  const input = unitInput.parse(raw);
  return transaction(async (tx) => {
    const unit = await tx.unit.create({ data: input });
    await recordEvent(tx, actor, "unit.create", "Unit", unit.id, { summary: unit.ref, after: unit });
    return unit;
  });
}

export async function updateUnit(actor: Actor, id: string, raw: Partial<z.input<typeof unitInput>>) {
  assertCan(actor, "project.write");
  const input = unitInput.omit({ projectId: true }).partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.unit.findUnique({ where: { id } }), "Module / frame");
    const unit = await tx.unit.update({ where: { id }, data: input });
    const d = diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "unit.update", "Unit", id, { summary: before.ref, before: d.before, after: d.after });
    return unit;
  });
}

export async function listUnits(actor: Actor, projectId?: string | null) {
  assertCan(actor, "records.view");
  return db.unit.findMany({
    where: projectId ? { projectId } : {},
    orderBy: [{ projectId: "asc" }, { ref: "asc" }],
    include: {
      project: { select: { code: true, name: true } },
      _count: { select: { photos: true, inspections: true, welds: true } },
      ncrs: { where: { status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true } },
    },
  });
}

export interface TimelineEntry {
  at: Date;
  /** True when the date is an upload/record time rather than when it happened. */
  approximate: boolean;
  kind: "project" | "photo" | "inspection" | "weld" | "material" | "ndt" | "coating" | "ncr" | "repair" | "release";
  title: string;
  detail?: string | null;
  status?: string | null;
  href?: string;
  thumbId?: string;
}

/** Chronological history of a project assembled from every linked record. */
export async function projectTimeline(actor: Actor, projectId: string): Promise<TimelineEntry[]> {
  assertCan(actor, "records.view");
  const [project, photos, inspections, welds, materials, ndt, coatings, ncrs, repairs, releases] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId } }),
    db.photo.findMany({ where: { projectId, deletedAt: null }, include: { unit: { select: { ref: true } } } }),
    db.inspection.findMany({ where: { projectId, status: { not: "CANCELLED" } }, include: { unit: { select: { ref: true } } } }),
    db.weld.findMany({ where: { projectId, inspectedAt: { not: null } } }),
    db.material.findMany({ where: { projectId } }),
    db.ndtRecord.findMany({ where: { projectId } }),
    db.coatingRecord.findMany({ where: { projectId } }),
    db.ncr.findMany({ where: { projectId } }),
    db.repair.findMany({ where: { projectId } }),
    db.releaseRecord.findMany({ where: { projectId }, include: { unit: { select: { ref: true } } } }),
  ]);

  const out: TimelineEntry[] = [];
  if (project.startDate) out.push({ at: project.startDate, approximate: false, kind: "project", title: "Project commenced", detail: project.scope });

  for (const p of photos) {
    out.push({
      at: p.takenAt ?? p.uploadedAt,
      approximate: !p.takenAt,
      kind: "photo",
      title: `${p.category}${p.unit ? ` · ${p.unit.ref}` : ""}`,
      detail: p.caption,
      status: p.reviewStatus,
      href: `/photos/${p.id}`,
      thumbId: p.thumbKey ? p.id : undefined,
    });
  }
  for (const i of inspections) {
    out.push({
      at: i.inspectedAt ?? i.plannedDate ?? i.createdAt,
      approximate: !i.inspectedAt,
      kind: "inspection",
      title: `${i.code} ${i.type.replace(/_/g, " ").toLowerCase()}${i.unit ? ` · ${i.unit.ref}` : ""}`,
      detail: i.operation ?? i.comments,
      status: i.result,
      href: `/inspections/${i.id}`,
    });
  }
  for (const w of welds) {
    out.push({ at: w.inspectedAt!, approximate: false, kind: "weld", title: `Weld ${w.weldRef} visual inspection`, status: w.visualResult, href: `/welding/${w.id}` });
  }
  for (const m of materials) {
    out.push({
      at: m.inspectedAt ?? m.createdAt,
      approximate: !m.inspectedAt,
      kind: "material",
      title: `Material ${m.code} received${m.heatNumber ? ` · heat ${m.heatNumber}` : ""}`,
      detail: m.description,
      status: m.status,
      href: `/materials/${m.id}`,
    });
  }
  for (const n of ndt) {
    out.push({ at: n.reportDate ?? n.requestedAt, approximate: false, kind: "ndt", title: `${n.code} ${n.method}`, status: n.result, href: `/ndt` });
  }
  for (const c of coatings) {
    out.push({ at: c.inspectedAt ?? c.createdAt, approximate: !c.inspectedAt, kind: "coating", title: `${c.code} coating inspection`, status: c.result, href: `/coating` });
  }
  for (const n of ncrs) {
    out.push({ at: n.raisedAt, approximate: false, kind: "ncr", title: `${n.code} raised — ${n.defectCategory}`, detail: n.description, status: n.priority, href: `/ncr/${n.id}` });
    if (n.closedAt) out.push({ at: n.closedAt, approximate: false, kind: "ncr", title: `${n.code} closed`, status: "CLOSED", href: `/ncr/${n.id}` });
  }
  for (const r of repairs) {
    out.push({ at: r.performedAt ?? r.createdAt, approximate: !r.performedAt, kind: "repair", title: `${r.code} repair`, detail: r.description, status: r.reinspectionResult, href: `/rework` });
  }
  for (const r of releases) {
    out.push({ at: r.releasedAt, approximate: false, kind: "release", title: `${r.unit ? r.unit.ref : "Project"} ${r.status.replace(/_/g, " ").toLowerCase()}`, detail: `By ${r.releasedByName}`, status: r.status, href: `/release` });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
