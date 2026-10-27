import type { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import { PERMISSIONS, type Actor } from "../permissions";
import { getSetting, type SettingKey } from "../settings";
import { storage } from "../storage";
import { assertCan, transaction } from "./base";

const lines = z.array(z.string().trim().min(1).max(120)).max(100);
const permList = z.array(z.string().refine((p) => p in PERMISSIONS, "Unknown permission"));
const ROLES = ["ADMIN", "QUALITY_MANAGER", "QC_INSPECTOR", "WELDING_INSPECTOR", "MATERIAL_INSPECTOR", "PRODUCTION_VIEWER", "AUDITOR"] as const;

export const SETTING_SCHEMAS = {
  releaseRules: z.object({
    requireFinalInspectionPass: z.boolean(),
    requireNoUnresolvedInspections: z.boolean(),
    requireNoOpenNcrs: z.boolean(),
    requireNoOpenActions: z.boolean(),
    requireMaterialsAccepted: z.boolean(),
    requireCertificatesVerified: z.boolean(),
    requireWeldsAccepted: z.boolean(),
    requireNdtComplete: z.boolean(),
    requiredPhotoCategories: lines,
    allowConcession: z.boolean(),
  }),
  uploadLimits: z.object({ maxFileMb: z.number().int().min(1).max(200), maxFilesPerBatch: z.number().int().min(1).max(200) }),
  notificationThresholds: z.object({
    ncrDueSoonDays: z.number().int().min(0).max(90),
    actionDueSoonDays: z.number().int().min(0).max(90),
    calibrationDueSoonDays: z.number().int().min(0).max(365),
    ndtOutstandingDays: z.number().int().min(0).max(365),
    quarantineReviewDays: z.number().int().min(0).max(365),
  }),
  vocabulary: z.object({ photoCategories: lines.min(1), productionStages: lines.min(1) }),
  branding: z.object({ companyName: z.string().trim().min(1).max(120), departmentName: z.string().trim().min(1).max(120), reportFooter: z.string().trim().max(300) }),
  rolePermissions: z.record(z.enum(ROLES), permList).nullable(),
} satisfies Record<SettingKey, z.ZodType>;

/** Validate and store a configuration value, with an audit entry. */
export async function updateSetting<K extends SettingKey>(actor: Actor, key: K, value: unknown) {
  assertCan(actor, "settings.manage");
  const schema = SETTING_SCHEMAS[key];
  if (!schema) throw new ValidationError("Unknown setting.");
  let parsed = schema.parse(value) as unknown;
  if (key === "rolePermissions" && parsed) {
    const map = { ...(parsed as Record<Role, string[]>) };
    // Administrators can never lose the ability to manage users/settings.
    map.ADMIN = [...new Set([...(map.ADMIN ?? []), "users.manage", "settings.manage", "records.view"])];
    parsed = map;
  }
  return transaction(async (tx) => {
    const before = await getSetting(key, tx);
    if (parsed === null) await tx.setting.deleteMany({ where: { key } });
    else
      await tx.setting.upsert({
        where: { key },
        create: { key, value: parsed as Prisma.InputJsonValue, updatedBy: actor.id },
        update: { value: parsed as Prisma.InputJsonValue, updatedBy: actor.id },
      });
    await recordEvent(tx, actor, "settings.update", "Setting", key, { summary: `Setting "${key}" changed`, before, after: parsed });
    return parsed;
  });
}

/** Count demo vs real rows for the main tables. */
export async function demoCounts() {
  const pairs = await Promise.all(
    (
      [
        ["Projects", db.project],
        ["Modules / frames", db.unit],
        ["Photos", db.photo],
        ["Inspections", db.inspection],
        ["Welds", db.weld],
        ["Weld defects", db.weldDefect],
        ["Materials", db.material],
        ["NDT records", db.ndtRecord],
        ["Coating records", db.coatingRecord],
        ["NCRs", db.ncr],
        ["Corrective actions", db.correctiveAction],
        ["Repairs", db.repair],
        ["Audits", db.qualityAudit],
        ["Audit findings", db.auditFinding],
        ["Documents", db.document],
        ["Equipment", db.equipment],
        ["Calibrations", db.calibrationRecord],
        ["Release records", db.releaseRecord],
      ] as const
    ).map(async ([label, model]) => {
      const m = model as unknown as { count: (a: { where: { isDemo: boolean } }) => Promise<number> };
      const [demo, real] = await Promise.all([m.count({ where: { isDemo: true } }), m.count({ where: { isDemo: false } })]);
      return { label, demo, real };
    }),
  );
  return pairs;
}

/**
 * Delete every record flagged isDemo, in foreign-key-safe order, inside one
 * transaction. Real records are never touched. Demo user accounts
 * (@example.com) are deactivated rather than deleted. Stored files of the
 * deleted demo photos and reports are removed afterwards.
 */
export async function purgeDemoData(actor: Actor) {
  assertCan(actor, "settings.manage");
  const result = await transaction(async (tx) => {
    const demoProjects = (await tx.project.findMany({ where: { isDemo: true }, select: { id: true } })).map((p) => p.id);
    // Refuse if real records hang off demo projects — deleting would orphan them.
    const realOnDemo = await Promise.all([
      tx.inspection.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.photo.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.ncr.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.weld.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.unit.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.repair.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.ndtRecord.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.coatingRecord.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      tx.releaseRecord.count({ where: { projectId: { in: demoProjects }, isDemo: false } }),
      // Children that would be cascade-deleted with a demo parent.
      tx.correctiveAction.count({ where: { isDemo: false, OR: [{ ncr: { isDemo: true } }, { auditFinding: { isDemo: true } }] } }),
      tx.auditFinding.count({ where: { isDemo: false, audit: { isDemo: true } } }),
      tx.calibrationRecord.count({ where: { isDemo: false, equipment: { isDemo: true } } }),
    ]);
    if (realOnDemo.some((n) => n > 0)) throw new ValidationError("Real records are linked to demo projects or demo records (e.g. actions on a demo NCR). Move or remove them before purging demo data.");

    const photos = await tx.photo.findMany({ where: { isDemo: true }, select: { storageKey: true, thumbKey: true } });
    const reports = await tx.reportJob.findMany({ where: { projectId: { in: demoProjects } }, select: { storageKey: true } });
    // Reminder dedupe keys are KIND:<record id>; collect demo ids to clear them.
    const idsOf = async (m: { findMany: (a: object) => Promise<{ id: string }[]> }) => (await m.findMany({ where: { isDemo: true }, select: { id: true } })).map((r) => r.id);
    const demoIds = new Set(
      (
        await Promise.all([tx.inspection, tx.ncr, tx.correctiveAction, tx.material, tx.ndtRecord, tx.equipment, tx.auditFinding, tx.project].map((m) => idsOf(m as unknown as Parameters<typeof idsOf>[0])))
      ).flat(),
    );
    const notes = await tx.notification.findMany({ select: { id: true, dedupeKey: true } });
    const noteIds = notes.filter((n) => demoIds.has(n.dedupeKey.split(":").slice(1).join(":"))).map((n) => n.id);
    const counts: Record<string, number> = {};
    const del = async (label: string, p: Promise<{ count: number }>) => (counts[label] = (await p).count);

    await del("photos", tx.photo.deleteMany({ where: { isDemo: true } }));
    await del("reportJobs", tx.reportJob.deleteMany({ where: { projectId: { in: demoProjects } } }));
    await del("releases", tx.releaseRecord.deleteMany({ where: { isDemo: true } }));
    await del("repairs", tx.repair.deleteMany({ where: { isDemo: true } }));
    await del("actions", tx.correctiveAction.deleteMany({ where: { isDemo: true } }));
    await del("ncrs", tx.ncr.deleteMany({ where: { isDemo: true } }));
    await del("weldDefects", tx.weldDefect.deleteMany({ where: { isDemo: true } }));
    await del("ndt", tx.ndtRecord.deleteMany({ where: { isDemo: true } }));
    await del("coatings", tx.coatingRecord.deleteMany({ where: { isDemo: true } }));
    // Re-inspection links among demo inspections must go before deletion.
    await tx.inspection.updateMany({ where: { isDemo: true }, data: { reinspectionOfId: null } });
    await del("inspections", tx.inspection.deleteMany({ where: { isDemo: true } }));
    await del("welds", tx.weld.deleteMany({ where: { isDemo: true } }));
    await del("materials", tx.material.deleteMany({ where: { isDemo: true } }));
    await del("findings", tx.auditFinding.deleteMany({ where: { isDemo: true } }));
    await del("audits", tx.qualityAudit.deleteMany({ where: { isDemo: true } }));
    await del("documents", tx.document.deleteMany({ where: { isDemo: true } }));
    await del("calibrations", tx.calibrationRecord.deleteMany({ where: { isDemo: true } }));
    await del("equipment", tx.equipment.deleteMany({ where: { isDemo: true } }));
    await del("templates", tx.checklistTemplate.deleteMany({ where: { isDemo: true } }));
    await tx.unit.updateMany({ where: { isDemo: true }, data: { parentId: null } });
    await del("units", tx.unit.deleteMany({ where: { isDemo: true } }));
    await del("projects", tx.project.deleteMany({ where: { isDemo: true } }));
    await del("notifications", tx.notification.deleteMany({ where: { id: { in: noteIds } } }));
    await del("demoUsersDeactivated", tx.user.updateMany({ where: { email: { endsWith: "@example.com" }, active: true, id: { not: actor.id } }, data: { active: false } }));
    await tx.session.deleteMany({ where: { user: { email: { endsWith: "@example.com" } } } });
    await recordEvent(tx, actor, "demo.purge", "Setting", "demoData", { summary: `Demo data purged: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`, after: counts });
    return { counts, keys: [...photos.flatMap((p) => [p.storageKey, p.thumbKey]), ...reports.map((r) => r.storageKey)].filter((k): k is string => !!k) };
  });
  let filesRemoved = 0;
  for (const key of result.keys) {
    try {
      await storage().remove(key);
      filesRemoved++;
    } catch (e) {
      console.error("could not remove demo file", key, e);
    }
  }
  return { ...result.counts, filesRemoved };
}
