import { db } from "../db";
import type { Actor, Permission } from "../permissions";
import { permissionsFor } from "../permissions";
import { getSetting } from "../settings";
import { OPEN_NCR } from "./ncrs";
import { extraConditions, loadRules, type Condition, type LoadedRule } from "./alert-rules";
import { syncAlerts } from "./alerts";

export const NOTIFICATION_KINDS: Record<string, { label: string; audience: Permission }> = {
  INSPECTION_OVERDUE: { label: "Overdue inspections", audience: "inspection.write" },
  NCR_DUE_SOON: { label: "NCRs approaching due date", audience: "ncr.manage" },
  NCR_OVERDUE: { label: "Overdue NCRs", audience: "ncr.manage" },
  ACTION_OVERDUE: { label: "Overdue corrective actions", audience: "ncr.manage" },
  CERT_MISSING: { label: "Missing / unverified material certificates", audience: "material.disposition" },
  QUARANTINE_REVIEW: { label: "Quarantined materials awaiting review", audience: "material.disposition" },
  EVIDENCE_MISSING: { label: "Missing required evidence", audience: "photo.review" },
  NDT_OUTSTANDING: { label: "Outstanding NDT reports", audience: "ndt.write" },
  CALIBRATION_DUE: { label: "Calibration due / expired", audience: "calibration.write" },
  AUDIT_ACTION_DUE: { label: "Audit findings due", audience: "audit.write" },
  AWAITING_RELEASE: { label: "Projects awaiting final release", audience: "release.approve" },
  NCR_EFFECTIVENESS_DUE: { label: "NCR effectiveness checks due", audience: "ncr.close" },
  HOLD_POINT_OPEN: { label: "ITP Hold Points open on projects awaiting release", audience: "release.approve" },
  REPEAT_WELD_DEFECT: { label: "Repeated weld defect type", audience: "weld.confirm" },
  FAILED_INSPECTION_NO_NCR: { label: "Failed inspection without NCR", audience: "ncr.manage" },
  MATERIAL_HEAT_MISSING: { label: "Missing heat / batch numbers", audience: "material.disposition" },
  MATERIAL_ID_MISMATCH: { label: "Material identifier mismatch", audience: "material.disposition" },
  CMR_CRITICAL_FAULT: { label: "Critical equipment faults (CMR)", audience: "cmr.work" },
  CMR_OVERDUE: { label: "Overdue CMRs", audience: "cmr.work" },
  CMR_REPEAT_FAULT: { label: "Repeated faults on the same asset", audience: "cmr.work" },
  CMR_VERIFICATION_PENDING: { label: "CMR return-to-service verification outstanding", audience: "cmr.verify" },
  EQUIPMENT_UNAVAILABLE: { label: "Equipment out of service", audience: "cmr.work" },
  REPEAT_NCR: { label: "Repeat non-conformances", audience: "ncr.manage" },
  REWORK_AWAITING_INSPECTION: { label: "Rework awaiting inspection", audience: "inspection.review" },
  SYSTEM_REVIEW: { label: "Scheduled system & quality review reports", audience: "system.view" },
  SYSTEM_ESCALATION: { label: "Critical escalations from the scheduled review", audience: "system.view" },
};

/** Notifications written by the scheduled review, not by rule conditions; the
 *  condition scan must not resolve them. */
export const REPORT_NOTIFICATION_KINDS = ["SYSTEM_REVIEW", "SYSTEM_ESCALATION"];


const DAY = 86_400_000;

/** Work out every condition that currently deserves a reminder. */
export async function collectConditions(now = new Date(), loaded?: Record<string, LoadedRule>): Promise<Condition[]> {
  const ruleSet = loaded ?? (await loadRules());
  const t = await getSetting("notificationThresholds");
  const rules = await getSetting("releaseRules");
  const out: Condition[] = [];

  const [inspections, ncrs, actions, materials, ndt, equipment, findings, awaiting, activeProjects] = await Promise.all([
    db.inspection.findMany({ where: { status: { in: ["DRAFT", "REJECTED"] }, plannedDate: { lt: now } }, select: { id: true, code: true, plannedDate: true, project: { select: { code: true } } } }),
    db.ncr.findMany({ where: { status: { in: OPEN_NCR }, targetDate: { not: null, lt: new Date(now.getTime() + t.ncrDueSoonDays * DAY) } }, select: { id: true, code: true, targetDate: true, priority: true } }),
    db.correctiveAction.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } }, select: { id: true, code: true, ncrId: true, auditFinding: { select: { auditId: true } } } }),
    db.material.findMany({ where: { status: { not: "REJECTED" } }, select: { id: true, code: true, certStatus: true, status: true, dispositionAt: true, updatedAt: true } }),
    db.ndtRecord.findMany({ where: { result: "PENDING", requestedAt: { lt: new Date(now.getTime() - t.ndtOutstandingDays * DAY) } }, select: { id: true, code: true, method: true } }),
    db.equipment.findMany({ where: { active: true }, select: { id: true, assetNo: true, calibrations: { orderBy: { dueAt: "desc" }, take: 1, select: { dueAt: true } } } }),
    db.auditFinding.findMany({ where: { status: { not: "CLOSED" }, dueDate: { lt: new Date(now.getTime() + t.actionDueSoonDays * DAY) } }, select: { id: true, code: true, auditId: true, dueDate: true } }),
    db.project.findMany({ where: { status: "AWAITING_RELEASE" }, select: { id: true, code: true, name: true } }),
    db.project.findMany({ where: { status: { in: ["ACTIVE", "AWAITING_RELEASE"] } }, select: { id: true, code: true } }),
  ]);

  for (const i of inspections) out.push({ kind: "INSPECTION_OVERDUE", key: i.id, severity: "warning", title: `${i.code} is overdue`, body: `${i.project.code} — planned ${i.plannedDate?.toISOString().slice(0, 10)}`, href: `/inspections/${i.id}` });
  for (const n of ncrs) {
    const overdue = n.targetDate! < now;
    out.push({ kind: overdue ? "NCR_OVERDUE" : "NCR_DUE_SOON", key: n.id, severity: overdue ? "critical" : "warning", title: `${n.code} ${overdue ? "is overdue" : "is due soon"}`, body: `Target ${n.targetDate!.toISOString().slice(0, 10)} · ${n.priority.toLowerCase()} priority`, href: `/ncr/${n.id}` });
  }
  for (const a of actions) out.push({ kind: "ACTION_OVERDUE", key: a.id, severity: "critical", title: `Action ${a.code} is overdue`, href: a.ncrId ? `/ncr/${a.ncrId}` : a.auditFinding ? `/audits/${a.auditFinding.auditId}` : undefined });
  for (const m of materials) {
    if (m.certStatus === "MISSING" || m.certStatus === "UPLOADED_UNVERIFIED") out.push({ kind: "CERT_MISSING", key: m.id, severity: "warning", title: `${m.code}: certificate ${m.certStatus === "MISSING" ? "missing" : "awaiting verification"}`, href: `/materials/${m.id}` });
    const since = m.dispositionAt ?? m.updatedAt;
    if (m.status === "QUARANTINED" && now.getTime() - since.getTime() > t.quarantineReviewDays * DAY) out.push({ kind: "QUARANTINE_REVIEW", key: m.id, severity: "warning", title: `${m.code} quarantined over ${t.quarantineReviewDays} days`, href: `/materials/${m.id}` });
  }
  for (const n of ndt) out.push({ kind: "NDT_OUTSTANDING", key: n.id, severity: "warning", title: `${n.code} ${n.method} report outstanding`, href: `/ndt` });
  for (const e of equipment) {
    const due = e.calibrations[0]?.dueAt;
    if (!due) out.push({ kind: "CALIBRATION_DUE", key: e.id, severity: "warning", title: `${e.assetNo} has no calibration record`, href: `/documents?tab=calibration` });
    else if (due < now) out.push({ kind: "CALIBRATION_DUE", key: e.id, severity: "critical", title: `${e.assetNo} calibration expired`, body: `Expired ${due.toISOString().slice(0, 10)}`, href: `/documents?tab=calibration` });
    else if (due.getTime() - now.getTime() < t.calibrationDueSoonDays * DAY) out.push({ kind: "CALIBRATION_DUE", key: e.id, severity: "info", title: `${e.assetNo} calibration due ${due.toISOString().slice(0, 10)}`, href: `/documents?tab=calibration` });
  }
  for (const f of findings) out.push({ kind: "AUDIT_ACTION_DUE", key: f.id, severity: f.dueDate! < now ? "critical" : "warning", title: `Audit finding ${f.code} ${f.dueDate! < now ? "overdue" : "due soon"}`, href: `/audits/${f.auditId}` });
  const effectiveness = await db.ncr.findMany({ where: { status: "CLOSED", effectivenessStatus: "PENDING", effectivenessDueAt: { lt: new Date(now.getTime() + t.ncrDueSoonDays * DAY) } }, select: { id: true, code: true, effectivenessDueAt: true } });
  for (const n of effectiveness) out.push({ kind: "NCR_EFFECTIVENESS_DUE", key: n.id, severity: n.effectivenessDueAt! < now ? "warning" : "info", title: `${n.code} effectiveness check ${n.effectivenessDueAt! < now ? "overdue" : "due"}`, body: `Due ${n.effectivenessDueAt!.toISOString().slice(0, 10)}`, href: `/ncr/${n.id}` });
  if (awaiting.length) {
    const holds = await db.controlPoint.groupBy({ by: ["planId"], where: { pointType: "H", status: "OPEN", plan: { projectId: { in: awaiting.map((p) => p.id) } } }, _count: true });
    const plans = await db.itpPlan.findMany({ where: { id: { in: holds.map((h) => h.planId) } }, select: { id: true, projectId: true } });
    for (const p of awaiting) {
      const n = holds.filter((h) => plans.find((pl) => pl.id === h.planId)?.projectId === p.id).reduce((s, h) => s + h._count, 0);
      if (n) out.push({ kind: "HOLD_POINT_OPEN", key: p.id, severity: "warning", title: `${p.code}: ${n} ITP Hold Point(s) open`, body: "Release is blocked until signed", href: `/projects/${p.id}?tab=itp`, projectId: p.id });
    }
  }
  for (const p of awaiting) out.push({ kind: "AWAITING_RELEASE", key: p.id, severity: "info", title: `${p.code} awaiting final release`, body: p.name, href: `/release?projectId=${p.id}`, projectId: p.id });

  if (rules.requiredPhotoCategories.length && activeProjects.length) {
    const have = await db.photo.groupBy({ by: ["projectId", "category"], where: { projectId: { in: activeProjects.map((p) => p.id) }, deletedAt: null } });
    for (const p of activeProjects) {
      const cats = new Set(have.filter((h) => h.projectId === p.id).map((h) => h.category));
      const missing = rules.requiredPhotoCategories.filter((c) => !cats.has(c));
      if (missing.length) out.push({ kind: "EVIDENCE_MISSING", key: p.id, severity: "info", title: `${p.code} missing evidence`, body: missing.join(", "), href: `/projects/${p.id}?tab=photos`, projectId: p.id });
    }
  }
  out.push(...(await extraConditions(now, ruleSet)));
  // A rule switched off in Settings → Alert rules raises neither alerts nor reminders.
  return out.filter((c) => ruleSet[c.kind]?.enabled !== false);
}

/**
 * Sync in-app notifications with current conditions. Idempotent: one row per
 * user per condition (unique dedupeKey); conditions that cleared are marked
 * resolved. Sends nothing outside the app.
 */
export async function runNotificationScan(now = new Date()) {
  const rules = await loadRules();
  const [conditions, users, overrides] = await Promise.all([collectConditions(now, rules), db.user.findMany({ where: { active: true } }), getSetting("rolePermissions")]);
  const alerts = await syncAlerts(conditions, rules, now);
  let created = 0;
  const liveKeys = new Set(conditions.map((c) => `${c.kind}:${c.key}`));
  for (const u of users) {
    const perms = permissionsFor(u.role, overrides);
    const muted = new Set(((u.notificationPrefs as { muted?: string[] } | null)?.muted ?? []) as string[]);
    for (const c of conditions) {
      if (!NOTIFICATION_KINDS[c.kind] || !perms.has(NOTIFICATION_KINDS[c.kind].audience) || muted.has(c.kind)) continue;
      const dedupeKey = `${c.kind}:${c.key}`;
      const res = await db.notification.upsert({
        where: { userId_dedupeKey: { userId: u.id, dedupeKey } },
        create: { userId: u.id, dedupeKey, kind: c.kind, severity: c.severity, title: c.title, body: c.body, href: c.href },
        // Update wording/severity, but keep read state unless it re-opened.
        update: { title: c.title, body: c.body, severity: c.severity, href: c.href, resolvedAt: null },
      });
      if (res.createdAt.getTime() >= now.getTime() - 1000) created++;
    }
  }
  const stale = await db.notification.findMany({ where: { resolvedAt: null, kind: { notIn: REPORT_NOTIFICATION_KINDS } }, select: { id: true, dedupeKey: true } });
  const toResolve = stale.filter((n) => !liveKeys.has(n.dedupeKey)).map((n) => n.id);
  if (toResolve.length) await db.notification.updateMany({ where: { id: { in: toResolve } }, data: { resolvedAt: now } });
  await db.setting.upsert({ where: { key: "lastNotificationScan" }, create: { key: "lastNotificationScan", value: now.toISOString() }, update: { value: now.toISOString() } });
  return { conditions: conditions.length, created, resolved: toResolve.length, alerts, conditionList: conditions };
}

/** Run a scan if the last one is older than `minutes`. Cheap to call on page load. */
export async function maybeScan(minutes = 10) {
  const row = await db.setting.findUnique({ where: { key: "lastNotificationScan" } });
  const last = row ? new Date(row.value as string) : null;
  if (last && Date.now() - last.getTime() < minutes * 60_000) return null;
  return runNotificationScan();
}

export async function listNotifications(actor: Actor, opts: { includeRead?: boolean } = {}) {
  return db.notification.findMany({
    where: { userId: actor.id, resolvedAt: null, ...(opts.includeRead ? {} : { readAt: null }) },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function markRead(actor: Actor, ids: string[] | "all") {
  await db.notification.updateMany({ where: { userId: actor.id, ...(ids === "all" ? {} : { id: { in: ids } }), readAt: null }, data: { readAt: new Date() } });
}

export async function setMuted(actor: Actor, muted: string[]) {
  const valid = muted.filter((m) => m in NOTIFICATION_KINDS);
  await db.user.update({ where: { id: actor.id }, data: { notificationPrefs: { muted: valid } } });
  await db.notification.updateMany({ where: { userId: actor.id, kind: { in: valid }, readAt: null }, data: { readAt: new Date() } });
}
