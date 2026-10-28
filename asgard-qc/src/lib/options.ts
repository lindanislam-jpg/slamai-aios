import "server-only";
import { db } from "./db";

/** Select options shared by many forms. */
export async function projectOptions() {
  const rows = await db.project.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { code: "desc" }, select: { id: true, code: true, name: true, isDemo: true } });
  return rows.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}${p.isDemo ? " (demo)" : ""}` }));
}

export async function unitOptions(projectId?: string | null) {
  const rows = await db.unit.findMany({ where: projectId ? { projectId } : {}, orderBy: [{ project: { code: "desc" } }, { ref: "asc" }], select: { id: true, ref: true, type: true, project: { select: { code: true } } } });
  return rows.map((u) => ({ value: u.id, label: projectId ? `${u.ref} (${u.type.toLowerCase()})` : `${u.project.code} / ${u.ref}` }));
}

export async function equipmentOptions() {
  const rows = await db.equipment.findMany({ where: { active: true }, orderBy: { assetNo: "asc" }, select: { id: true, assetNo: true, description: true, location: true } });
  return rows.map((e) => ({ value: e.id, label: `${e.assetNo} — ${e.description}${e.location ? ` (${e.location})` : ""}` }));
}
