import sharp from "sharp";
import { db } from "../db";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { assertCan } from "../services/base";
import { uploadPhotos } from "../services/photos";

/** Generated placeholder image — clearly marked, never a factory photograph. */
export async function demoPhoto(label: string, hue: number, takenAt: Date | null) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,32%)"/><stop offset="1" stop-color="hsl(${hue + 30},30%,14%)"/></linearGradient></defs>
    <rect width="1200" height="900" fill="url(#g)"/>
    <g stroke="hsl(${hue},20%,55%)" stroke-width="18" fill="none" opacity="0.55"><path d="M120 760 L600 160 L1080 760"/><path d="M300 760 L600 400 L900 760"/><line x1="120" y1="760" x2="1080" y2="760"/></g>
    <text x="60" y="110" font-family="sans-serif" font-size="64" font-weight="700" fill="#e6c77f">DEMO PHOTO</text>
    <text x="60" y="180" font-family="sans-serif" font-size="40" fill="#ffffff">${label.replace(/&/g, "&amp;")}</text>
    <text x="60" y="850" font-family="sans-serif" font-size="28" fill="#c9d3de">Synthetic placeholder — not a factory photograph</text>
  </svg>`;
  let img = sharp(Buffer.from(svg)).jpeg({ quality: 82 });
  if (takenAt) img = img.withExif({ IFD2: { DateTimeOriginal: takenAt.toISOString().slice(0, 19).replace("T", " ").replace(/-/g, ":") } });
  return img.toBuffer();
}

const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setUTCHours(hour, 15, 0, 0);
  return d;
};

const PLAN: { label: string; category: string; stage: string; unit?: string; days: number | null; weldRef?: string; withNcr?: boolean; repairPhase?: "BEFORE" | "AFTER"; heat?: string; skid?: boolean }[] = [
  { label: "Project kick-off, bay 2", category: "Project commencement", stage: "Project commencement", days: 47 },
  { label: "RHS delivery, heat DEMO-H-77423", category: "Steel identification & heat numbers", stage: "Incoming materials", days: 45, heat: "DEMO-H-77423" },
  { label: "Plate delivery", category: "Incoming materials", stage: "Incoming materials", days: null, heat: "DEMO-H-77391" },
  { label: "Saw cutting RHS", category: "Cutting & preparation", stage: "Cutting & preparation", unit: "F-1041", days: 38 },
  { label: "Frame F-1042 on jig", category: "Frame assembly", stage: "Frame assembly", unit: "F-1042", days: 31 },
  { label: "Welding F-1043 base", category: "Welding in progress", stage: "Welding", unit: "F-1043", days: 27 },
  { label: "Weld F-1042-W2 undercut (before)", category: "Repair & rework — before", stage: "Welding", unit: "F-1042", days: 21, weldRef: "F-1042-W2", withNcr: true, repairPhase: "BEFORE" },
  { label: "Weld F-1041-W2 visual", category: "Weld visual inspection", stage: "Welding", unit: "F-1041", days: 19, weldRef: "F-1041-W2" },
  { label: "Flat bar stencil mismatch", category: "Steel identification & heat numbers", stage: "Incoming materials", days: 9, heat: "DEMO-H-77356" },
  { label: "Skid final inspection", category: "Final inspection", stage: "Final inspection", days: 2, skid: true },
  { label: "Skid coated", category: "Painting & coating", stage: "Painting & coating", days: 9, skid: true },
];

/**
 * Add the generated demo photographs to the demo projects. Separate from the
 * database seed because hosted builds cannot write to file storage.
 * Idempotent: does nothing if demo photos already exist.
 */
export async function addDemoPhotos(actor: Actor) {
  assertCan(actor, "settings.manage");
  const p1 = await db.project.findFirst({ where: { isDemo: true, name: "DEMO Site Office Modules — Block A" }, include: { units: true } });
  const p2 = await db.project.findFirst({ where: { isDemo: true, name: "DEMO Plant Room Skid" }, include: { units: true } });
  if (!p1 || !p2) throw new ValidationError("Demo projects are not present — load the demo data first.");
  if (await db.photo.count({ where: { isDemo: true } })) return { created: 0, skipped: true };

  const started = new Date(Date.now() - 1000);
  let created = 0;
  for (const [i, ph] of PLAN.entries()) {
    const project = ph.skid ? p2 : p1;
    const unit = ph.skid ? project.units[0] : ph.unit ? project.units.find((u) => u.ref === ph.unit) : undefined;
    const weld = ph.weldRef ? await db.weld.findFirst({ where: { projectId: p1.id, weldRef: ph.weldRef } }) : null;
    const ncr = ph.withNcr && weld ? await db.ncr.findFirst({ where: { weldId: weld.id } }) : null;
    const repair = ph.repairPhase && weld ? await db.repair.findFirst({ where: { weldId: weld.id }, orderBy: { createdAt: "desc" } }) : null;
    const material = ph.heat ? await db.material.findFirst({ where: { heatNumber: ph.heat, isDemo: true } }) : null;
    const buf = await demoPhoto(ph.label, (i * 37) % 360, ph.days == null ? null : ago(ph.days));
    const [res] = await uploadPhotos(actor, project.id, [{ name: `demo-${i + 1}.jpg`, data: buf }], {
      category: ph.category,
      stage: ph.stage,
      unitId: unit?.id,
      caption: `${ph.label} (demo)`,
      weldId: weld?.id,
      weldRef: weld?.weldRef,
      ncrId: ncr?.id,
      repairId: repair?.id,
      reworkPhase: repair ? ph.repairPhase : undefined,
      materialId: material?.id,
      heatNumber: material?.heatNumber ?? undefined,
      tags: "demo",
    });
    if (res.ok) created++;
    else console.warn("demo photo failed", res);
  }
  await db.photo.updateMany({ where: { uploadedAt: { gte: started }, tags: { has: "demo" } }, data: { isDemo: true } });
  return { created, skipped: false };
}
