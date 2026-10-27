import { db } from "../db";
import { evaluateRelease, loadReleaseContext, type ReleaseCheck } from "../services/release";
import { getSetting } from "../settings";
import { inspectionKpis } from "../kpi";
import { countBy } from "../services/welding";
import { materialFlags } from "../services/materials";

export const REPORT_TYPES = {
  EXECUTIVE: "Executive summary report",
  DETAILED: "Detailed project quality report",
  PHOTO: "Photographic evidence report",
  WELDING: "Welding inspection report",
  MATERIAL: "Material traceability report",
  NCR: "NCR / CAPA report",
  HANDOVER: "Final quality handover pack",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;

/** Which sections each report type contains. */
export const SECTIONS: Record<ReportType, string[]> = {
  EXECUTIVE: ["summary", "itp", "outstanding", "release"],
  DETAILED: ["summary", "timeline", "itp", "materials", "fabrication", "inspections", "welding", "ndt", "coating", "ncrs", "repairs", "photos", "outstanding", "release", "documents"],
  PHOTO: ["summary", "photos", "outstanding"],
  WELDING: ["summary", "welding", "ndt", "repairs", "photos:weld", "outstanding"],
  MATERIAL: ["summary", "materials", "photos:material", "outstanding"],
  NCR: ["summary", "ncrs", "repairs", "photos:ncr", "outstanding"],
  HANDOVER: ["summary", "timeline", "itp", "materials", "fabrication", "inspections", "welding", "ndt", "coating", "ncrs", "repairs", "photos", "outstanding", "release", "documents"],
};

export interface ReportParams {
  type: ReportType;
  projectId: string;
  unitId?: string | null;
  from?: Date | null;
  to?: Date | null;
}

const inRange = (d: Date | null | undefined, p: ReportParams) => !d || ((!p.from || d >= p.from) && (!p.to || d <= p.to));

/** Collect every record the report needs, straight from the database. */
export async function gatherReportData(p: ReportParams) {
  const scope = p.unitId ? { projectId: p.projectId, unitId: p.unitId } : { projectId: p.projectId };
  const [project, unit, branding, rules] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: p.projectId }, include: { units: { orderBy: { ref: "asc" } } } }),
    p.unitId ? db.unit.findUniqueOrThrow({ where: { id: p.unitId } }) : null,
    getSetting("branding"),
    getSetting("releaseRules"),
  ]);
  const itpPlans = await db.itpPlan.findMany({ where: { projectId: p.projectId }, orderBy: { createdAt: "asc" }, include: { points: { orderBy: { order: "asc" } } } });
  const [inspections, welds, materials, ndt, coatings, ncrs, repairs, photos, documents, releases] = await Promise.all([
    db.inspection.findMany({ where: { ...scope, status: { not: "CANCELLED" } }, include: { unit: { select: { ref: true } }, items: { orderBy: { order: "asc" } } }, orderBy: [{ inspectedAt: "asc" }, { createdAt: "asc" }] }),
    db.weld.findMany({ where: scope, include: { unit: { select: { ref: true } }, defects: true, repairs: true }, orderBy: { weldRef: "asc" } }),
    db.material.findMany({ where: { projectId: p.projectId }, orderBy: { code: "asc" } }),
    db.ndtRecord.findMany({ where: scope, include: { weld: { select: { weldRef: true } }, unit: { select: { ref: true } } }, orderBy: { requestedAt: "asc" } }),
    db.coatingRecord.findMany({ where: scope, include: { unit: { select: { ref: true } } }, orderBy: { createdAt: "asc" } }),
    db.ncr.findMany({ where: scope, include: { unit: { select: { ref: true } }, actions: true }, orderBy: { raisedAt: "asc" } }),
    db.repair.findMany({ where: scope, include: { unit: { select: { ref: true } }, ncr: { select: { code: true } }, weld: { select: { weldRef: true } } }, orderBy: { createdAt: "asc" } }),
    db.photo.findMany({
      where: { ...scope, deletedAt: null, reviewStatus: { not: "REJECTED" } },
      include: { unit: { select: { ref: true } }, inspection: { select: { code: true } }, ncr: { select: { code: true } }, weld: { select: { weldRef: true } }, material: { select: { code: true } }, repair: { select: { code: true } } },
      orderBy: [{ takenAt: { sort: "asc", nulls: "last" } }, { uploadedAt: "asc" }],
    }),
    db.document.findMany({ where: { OR: [{ projectId: p.projectId }, { projectId: null, docType: { in: ["WPS", "WPQR", "Procedure", "Inspection & test plan"] } }] }, include: { revisions: { orderBy: { uploadedAt: "desc" } } }, orderBy: { docNo: "asc" } }),
    db.releaseRecord.findMany({ where: { projectId: p.projectId, ...(p.unitId ? { unitId: p.unitId } : {}) }, include: { unit: { select: { ref: true } } }, orderBy: { releasedAt: "asc" } }),
  ]);

  const periodInspections = inspections.filter((i) => inRange(i.inspectedAt ?? i.plannedDate, p));
  const periodPhotos = photos.filter((ph) => inRange(ph.takenAt ?? ph.uploadedAt, p));
  const checks: ReleaseCheck[] = evaluateRelease(await loadReleaseContext(p.projectId, p.unitId), rules);

  // Outstanding items and gaps — listed, never filled in.
  const missing: string[] = [];
  for (const c of checks) if (c.state === "FAIL") missing.push(`${c.label}: ${c.detail}${c.items?.length ? ` (${c.items.slice(0, 8).join("; ")}${c.items.length > 8 ? "; …" : ""})` : ""}`);
  for (const m of materials) {
    const f = materialFlags(m);
    if (f.length) missing.push(`Material ${m.code}: ${f.join(", ")}`);
  }
  // One line per checklist item wording, not per occurrence.
  const unconfigured = new Map<string, string[]>();
  for (const i of inspections) for (const item of i.items) if (item.criteriaStatus === "REQUIRES_CONFIGURATION") {
    unconfigured.set(item.description, [...(unconfigured.get(item.description) ?? []), i.code]);
  }
  for (const [desc, codes] of unconfigured) {
    missing.push(`Checklist item "${desc}" has no approved acceptance criterion recorded (${codes.length} inspection(s): ${codes.slice(0, 5).join(", ")}${codes.length > 5 ? ", …" : ""})`);
  }
  const noTakenAt = periodPhotos.filter((ph) => !ph.takenAt).length;
  if (noTakenAt) missing.push(`${noTakenAt} photo(s) have no capture date in their file metadata; upload time is shown instead and marked.`);
  if (!project.customerRef) missing.push("Customer reference not recorded (or not authorised for inclusion).");

  const activeRelease = releases.filter((r) => !r.revokedAt && (p.unitId ? r.unitId === p.unitId : !r.unitId)).at(-1) ?? null;

  return {
    params: p,
    branding,
    project,
    unit,
    inspections: periodInspections,
    inspectionStats: inspectionKpis(periodInspections),
    welds,
    defectPareto: countBy(welds.flatMap((w) => w.defects.filter((d) => d.confirmed)), (d) => d.category),
    materials,
    ndt,
    coatings,
    ncrs,
    repairs,
    photos: periodPhotos,
    documents,
    releases,
    itpPlans,
    activeRelease,
    checks,
    missing,
    isDemo: project.isDemo,
    cutoff: new Date(),
  };
}

export type ReportData = Awaited<ReturnType<typeof gatherReportData>>;
