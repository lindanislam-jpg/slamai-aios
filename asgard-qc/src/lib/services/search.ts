import { db } from "../db";
import type { Actor } from "../permissions";
import { assertCan } from "./base";

export interface SearchHit {
  type: string;
  code: string;
  title: string;
  href: string;
  context?: string | null;
}

/** One box for project IDs, frames, inspections, welds, heat numbers,
 *  certificates, NCRs, photos, documents, CMRs, equipment and alerts. */
export async function globalSearch(actor: Actor, raw: string): Promise<SearchHit[]> {
  assertCan(actor, "records.view");
  const q = raw.trim();
  if (q.length < 2) return [];
  const c = { contains: q, mode: "insensitive" as const };
  const [projects, units, inspections, welds, materials, ncrs, photos, documents, ndt, cmrs, equipment, alerts] = await Promise.all([
    db.project.findMany({ where: { OR: [{ code: c }, { name: c }, { customerRef: c }] }, take: 8 }),
    db.unit.findMany({ where: { OR: [{ ref: c }, { drawingRef: c }] }, take: 8, include: { project: { select: { code: true } } } }),
    db.inspection.findMany({ where: { OR: [{ code: c }, { componentRef: c }, { drawingRef: c }] }, take: 8, include: { project: { select: { code: true } } } }),
    db.weld.findMany({ where: { OR: [{ weldRef: c }, { wpsRef: c }, { welderId: c }] }, take: 8, include: { project: { select: { code: true } } } }),
    db.material.findMany({ where: { OR: [{ code: c }, { heatNumber: c }, { certificateRef: c }, { grade: c }] }, take: 8 }),
    db.ncr.findMany({ where: { OR: [{ code: c }, { description: c }] }, take: 8, include: { project: { select: { code: true } } } }),
    db.photo.findMany({ where: { deletedAt: null, OR: [{ code: c }, { caption: c }, { heatNumber: c }, { weldRef: c }] }, take: 8, include: { project: { select: { code: true } } } }),
    db.document.findMany({ where: { OR: [{ docNo: c }, { title: c }] }, take: 8 }),
    db.ndtRecord.findMany({ where: { OR: [{ code: c }, { reportNo: c }] }, take: 5, include: { project: { select: { code: true } } } }),
    db.cmr.findMany({ where: { OR: [{ code: c }, { problem: c }, { assetLabel: c }] }, take: 8, include: { equipment: { select: { assetNo: true } } } }),
    db.equipment.findMany({ where: { OR: [{ assetNo: c }, { description: c }, { serialNo: c }] }, take: 5 }),
    db.qualityAlert.findMany({ where: { OR: [{ code: c }, { title: c }] }, take: 5 }),
  ]);
  return [
    ...projects.map((p) => ({ type: "Project", code: p.code, title: p.name, href: `/projects/${p.id}`, context: p.status })),
    ...units.map((u) => ({ type: u.type === "MODULE" ? "Module" : u.type === "FRAME" ? "Frame" : "Component", code: u.ref, title: u.description ?? u.drawingRef ?? "", href: `/projects/${u.projectId}?tab=overview&unit=${u.id}`, context: u.project.code })),
    ...inspections.map((i) => ({ type: "Inspection", code: i.code, title: i.type.replace(/_/g, " ").toLowerCase(), href: `/inspections/${i.id}`, context: `${i.project.code} · ${i.result}` })),
    ...welds.map((w) => ({ type: "Weld", code: w.weldRef, title: w.wpsRef ? `WPS ${w.wpsRef}` : "", href: `/welding/${w.id}`, context: `${w.project.code} · ${w.status}` })),
    ...materials.map((m) => ({ type: "Material", code: m.code, title: `${m.description}${m.heatNumber ? ` · heat ${m.heatNumber}` : ""}`, href: `/materials/${m.id}`, context: m.status })),
    ...ncrs.map((n) => ({ type: "NCR", code: n.code, title: n.description.slice(0, 80), href: `/ncr/${n.id}`, context: `${n.project.code} · ${n.status}` })),
    ...photos.map((p) => ({ type: "Photo", code: p.code, title: p.caption ?? p.category, href: `/photos/${p.id}`, context: p.project.code })),
    ...documents.map((d) => ({ type: "Document", code: d.docNo, title: d.title, href: `/documents?q=${encodeURIComponent(d.docNo)}`, context: d.status })),
    ...ndt.map((n) => ({ type: "NDT", code: n.code, title: `${n.method}${n.reportNo ? ` · report ${n.reportNo}` : ""}`, href: `/ndt?projectId=${n.projectId}`, context: n.project.code })),
    ...cmrs.map((m) => ({ type: "CMR", code: m.code, title: m.problem.slice(0, 80), href: `/cmr/${m.id}`, context: `${m.equipment?.assetNo ?? m.assetLabel ?? ""} · ${m.status}` })),
    ...equipment.map((e) => ({ type: "Equipment", code: e.assetNo, title: e.description, href: `/cmr?equipmentId=${e.id}&status=all`, context: e.status })),
    ...alerts.map((a) => ({ type: "Alert", code: a.code, title: a.title, href: `/alerts/${a.id}`, context: `${a.severity} · ${a.status}` })),
  ];
}
