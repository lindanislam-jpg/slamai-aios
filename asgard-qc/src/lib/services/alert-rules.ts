import type { AlertSeverity, Prisma } from "@prisma/client";
import { db } from "../db";

/**
 * Smart Quality Alert rules. The evaluation logic is deterministic code keyed
 * by rule key; what an administrator may change (enabled, severity, numeric
 * thresholds) lives in the AlertRule table. Defaults below are starting points
 * only and must be confirmed for each operation — no threshold is assumed to
 * be universally right.
 */

export const ALERT_CATEGORIES = [
  "Welding & fabrication",
  "Material traceability",
  "CMR & equipment",
  "NCR, CAPA & rework",
  "Project completeness & release",
  "Audit readiness",
] as const;

export interface RuleDef {
  name: string;
  description: string;
  category: (typeof ALERT_CATEGORIES)[number];
  severity: AlertSeverity;
  /** Numeric thresholds an administrator may tune, with their meaning. */
  params?: Record<string, { value: number; label: string }>;
}

export const RULE_CATALOGUE: Record<string, RuleDef> = {
  // Welding & fabrication
  REPEAT_WELD_DEFECT: {
    name: "Repeated weld defect type",
    description: "The same confirmed weld defect category is recorded on one project at least {threshold} times within {windowDays} days.",
    category: "Welding & fabrication",
    severity: "HIGH",
    params: { threshold: { value: 3, label: "Defects of the same type" }, windowDays: { value: 30, label: "Within (days)" } },
  },
  FAILED_INSPECTION_NO_NCR: {
    name: "Failed inspection without NCR",
    description: "An inspection recorded as Fail has no linked NCR {graceDays} days after the inspection date.",
    category: "Welding & fabrication",
    severity: "HIGH",
    params: { graceDays: { value: 2, label: "Days allowed to raise the NCR" } },
  },
  INSPECTION_OVERDUE: { name: "Inspection overdue", description: "A planned inspection is past its planned date and still in draft or rejected.", category: "Welding & fabrication", severity: "MEDIUM" },
  // Material traceability
  MATERIAL_HEAT_MISSING: { name: "Missing heat / batch number", description: "Material allocated to a project has no heat or batch number recorded.", category: "Material traceability", severity: "HIGH" },
  MATERIAL_ID_MISMATCH: { name: "Material identifier mismatch", description: "Material is flagged with mismatched identification against its certificate.", category: "Material traceability", severity: "HIGH" },
  CERT_MISSING: { name: "Certificate missing / unverified", description: "A material certificate is missing or uploaded but not verified.", category: "Material traceability", severity: "MEDIUM" },
  QUARANTINE_REVIEW: { name: "Quarantine awaiting review", description: "Material has been quarantined longer than the configured review period.", category: "Material traceability", severity: "MEDIUM" },
  // CMR & equipment
  CMR_CRITICAL_FAULT: { name: "Critical equipment fault", description: "An open CMR is critical priority or has a safety impact.", category: "CMR & equipment", severity: "CRITICAL" },
  CMR_OVERDUE: {
    name: "CMR overdue",
    description: "An open CMR is past its requested response date, or older than the response time for its priority when no date was requested.",
    category: "CMR & equipment",
    severity: "HIGH",
    params: {
      criticalDays: { value: 1, label: "Response time – critical (days)" },
      highDays: { value: 3, label: "Response time – high (days)" },
      mediumDays: { value: 7, label: "Response time – medium (days)" },
      lowDays: { value: 14, label: "Response time – low (days)" },
    },
  },
  CMR_REPEAT_FAULT: {
    name: "Repeated fault on the same asset",
    description: "The same equipment has at least {threshold} CMRs raised within {windowDays} days.",
    category: "CMR & equipment",
    severity: "HIGH",
    params: { threshold: { value: 2, label: "CMRs on one asset" }, windowDays: { value: 90, label: "Within (days)" } },
  },
  CMR_VERIFICATION_PENDING: {
    name: "Return-to-service verification outstanding",
    description: "Maintenance work is complete but the repair has not been verified for {days} days.",
    category: "CMR & equipment",
    severity: "MEDIUM",
    params: { days: { value: 2, label: "Days awaiting verification" } },
  },
  EQUIPMENT_UNAVAILABLE: { name: "Equipment out of service", description: "Registered equipment is out of service and unavailable for production.", category: "CMR & equipment", severity: "HIGH" },
  CALIBRATION_DUE: { name: "Calibration overdue / due soon", description: "Equipment calibration is expired, missing, or due within the configured period.", category: "CMR & equipment", severity: "MEDIUM" },
  // NCR, CAPA & rework
  NCR_OVERDUE: { name: "NCR overdue", description: "An open NCR is past its target date.", category: "NCR, CAPA & rework", severity: "HIGH" },
  NCR_DUE_SOON: { name: "NCR approaching target date", description: "An open NCR is due within the configured period.", category: "NCR, CAPA & rework", severity: "LOW" },
  ACTION_OVERDUE: { name: "Corrective action overdue", description: "A corrective or preventive action is past its due date.", category: "NCR, CAPA & rework", severity: "HIGH" },
  NCR_EFFECTIVENESS_DUE: { name: "CAPA effectiveness check due", description: "A closed NCR's effectiveness verification is due or overdue.", category: "NCR, CAPA & rework", severity: "MEDIUM" },
  REPEAT_NCR: {
    name: "Repeat non-conformance",
    description: "At least {threshold} NCRs in the same defect category on one project within {windowDays} days.",
    category: "NCR, CAPA & rework",
    severity: "MEDIUM",
    params: { threshold: { value: 3, label: "NCRs of the same category" }, windowDays: { value: 90, label: "Within (days)" } },
  },
  REWORK_AWAITING_INSPECTION: {
    name: "Rework awaiting inspection",
    description: "A repair was performed but has not been re-inspected after {days} days.",
    category: "NCR, CAPA & rework",
    severity: "MEDIUM",
    params: { days: { value: 3, label: "Days since repair" } },
  },
  // Project completeness & release
  NDT_OUTSTANDING: { name: "NDT report outstanding", description: "An NDT request has no result after the configured period.", category: "Project completeness & release", severity: "MEDIUM" },
  HOLD_POINT_OPEN: { name: "Hold Points open at release", description: "A project awaiting release still has unsigned ITP Hold Points.", category: "Project completeness & release", severity: "HIGH" },
  EVIDENCE_MISSING: { name: "Required photo evidence missing", description: "An active project lacks a required photo evidence category.", category: "Project completeness & release", severity: "LOW" },
  AWAITING_RELEASE: { name: "Awaiting final release", description: "A project is awaiting final release approval.", category: "Project completeness & release", severity: "INFO" },
  // Audit readiness
  AUDIT_ACTION_DUE: { name: "Audit finding due / overdue", description: "An audit finding is open and due within the configured period, or overdue.", category: "Audit readiness", severity: "MEDIUM" },
};

export interface Condition {
  /** Rule key (also the notification kind). */
  kind: string;
  /** Affected record; with the rule key it identifies the alert. */
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body?: string;
  href?: string;
  projectId?: string | null;
  /** Records that triggered the condition. */
  evidence?: { ref: string; href?: string; note?: string }[];
}

export interface LoadedRule {
  key: string;
  name: string;
  category: string;
  severity: AlertSeverity;
  enabled: boolean;
  version: number;
  params: Record<string, number>;
}

/** Defaults merged with any stored values; missing rule rows are created. */
export async function loadRules(): Promise<Record<string, LoadedRule>> {
  const rows = await db.alertRule.findMany();
  const missing = Object.keys(RULE_CATALOGUE).filter((k) => !rows.some((r) => r.key === k));
  if (missing.length) {
    await db.alertRule.createMany({
      data: missing.map((key) => {
        const d = RULE_CATALOGUE[key];
        return { key, name: d.name, description: d.description, category: d.category, severity: d.severity, params: defaultParams(key) as Prisma.InputJsonValue };
      }),
      skipDuplicates: true,
    });
  }
  const all = missing.length ? await db.alertRule.findMany() : rows;
  const out: Record<string, LoadedRule> = {};
  for (const r of all) {
    if (!RULE_CATALOGUE[r.key]) continue;
    out[r.key] = { key: r.key, name: r.name, category: r.category, severity: r.severity, enabled: r.enabled, version: r.version, params: { ...defaultParams(r.key), ...((r.params as Record<string, number> | null) ?? {}) } };
  }
  return out;
}

export function defaultParams(key: string): Record<string, number> {
  return Object.fromEntries(Object.entries(RULE_CATALOGUE[key]?.params ?? {}).map(([k, v]) => [k, v.value]));
}

const DAY = 86_400_000;
const OPEN_CMR = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PARTS", "AWAITING_EXTERNAL", "AWAITING_VERIFICATION"] as const;
export { OPEN_CMR };

/** Conditions for the rules that are not part of the original reminder scan. */
export async function extraConditions(now: Date, rules: Record<string, LoadedRule>): Promise<Condition[]> {
  const on = (k: string) => rules[k]?.enabled !== false;
  const p = (k: string) => rules[k]?.params ?? defaultParams(k);
  const out: Condition[] = [];

  if (on("REPEAT_WELD_DEFECT")) {
    const { threshold, windowDays } = p("REPEAT_WELD_DEFECT");
    const defects = await db.weldDefect.findMany({
      where: { confirmed: true, recordedAt: { gte: new Date(now.getTime() - windowDays * DAY) } },
      select: { id: true, category: true, recordedAt: true, weld: { select: { id: true, weldRef: true, projectId: true, project: { select: { code: true } } } } },
    });
    const groups = new Map<string, typeof defects>();
    for (const d of defects) {
      const k = `${d.weld.projectId}:${d.category}`;
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    for (const [k, list] of groups) {
      if (list.length < threshold) continue;
      const first = list[0].weld;
      out.push({
        kind: "REPEAT_WELD_DEFECT", key: k, severity: "warning", projectId: first.projectId,
        title: `${first.project.code}: ${list.length} × ${list[0].category} in ${windowDays} days`,
        body: `Threshold ${threshold}. Welds: ${[...new Set(list.map((d) => d.weld.weldRef))].join(", ")}`,
        href: `/welding?projectId=${first.projectId}`,
        evidence: list.map((d) => ({ ref: `Weld ${d.weld.weldRef} – ${d.category}`, href: `/welding/${d.weld.id}`, note: d.recordedAt.toISOString().slice(0, 10) })),
      });
    }
  }

  if (on("FAILED_INSPECTION_NO_NCR")) {
    const { graceDays } = p("FAILED_INSPECTION_NO_NCR");
    const failed = await db.inspection.findMany({
      where: { result: "FAIL", status: { not: "CANCELLED" }, ncrs: { none: {} }, inspectedAt: { lt: new Date(now.getTime() - graceDays * DAY) } },
      select: { id: true, code: true, type: true, projectId: true, inspectedAt: true, project: { select: { code: true } } },
    });
    for (const i of failed) {
      out.push({
        kind: "FAILED_INSPECTION_NO_NCR", key: i.id, severity: "warning", projectId: i.projectId,
        title: `${i.code} failed with no NCR`, body: `${i.project.code} · ${i.type.replace(/_/g, " ").toLowerCase()} · ${i.inspectedAt!.toISOString().slice(0, 10)}`,
        href: `/inspections/${i.id}`, evidence: [{ ref: i.code, href: `/inspections/${i.id}`, note: "Result Fail, no NCR linked" }],
      });
    }
  }

  if (on("MATERIAL_HEAT_MISSING") || on("MATERIAL_ID_MISMATCH")) {
    const mats = await db.material.findMany({
      where: { projectId: { not: null }, status: { not: "REJECTED" }, OR: [{ heatNumber: null }, { heatNumber: "" }, { identificationMismatch: true }] },
      select: { id: true, code: true, description: true, heatNumber: true, identificationMismatch: true, projectId: true },
    });
    for (const m of mats) {
      if (on("MATERIAL_HEAT_MISSING") && !m.heatNumber?.trim())
        out.push({ kind: "MATERIAL_HEAT_MISSING", key: m.id, severity: "warning", projectId: m.projectId, title: `${m.code}: no heat / batch number`, body: m.description, href: `/materials/${m.id}`, evidence: [{ ref: m.code, href: `/materials/${m.id}` }] });
      if (on("MATERIAL_ID_MISMATCH") && m.identificationMismatch)
        out.push({ kind: "MATERIAL_ID_MISMATCH", key: m.id, severity: "warning", projectId: m.projectId, title: `${m.code}: identifier mismatch`, body: m.description, href: `/materials/${m.id}`, evidence: [{ ref: m.code, href: `/materials/${m.id}` }] });
    }
  }

  const needCmr = ["CMR_CRITICAL_FAULT", "CMR_OVERDUE", "CMR_REPEAT_FAULT", "CMR_VERIFICATION_PENDING"].some(on);
  if (needCmr) {
    const cmrs = await db.cmr.findMany({
      where: { OR: [{ status: { in: [...OPEN_CMR] } }, { reportedAt: { gte: new Date(now.getTime() - Math.max(p("CMR_REPEAT_FAULT").windowDays, 1) * DAY) } }] },
      select: { id: true, code: true, status: true, priority: true, safetyImpact: true, requestedBy: true, reportedAt: true, completedAt: true, updatedAt: true, problem: true, projectId: true, equipmentId: true, assetLabel: true, equipment: { select: { assetNo: true, description: true } } },
    });
    const asset = (c: (typeof cmrs)[number]) => c.equipment ? `${c.equipment.assetNo} ${c.equipment.description}` : (c.assetLabel ?? "unregistered asset");
    const open = cmrs.filter((c) => (OPEN_CMR as readonly string[]).includes(c.status));
    if (on("CMR_CRITICAL_FAULT"))
      for (const c of open.filter((c) => c.priority === "CRITICAL" || c.safetyImpact))
        out.push({ kind: "CMR_CRITICAL_FAULT", key: c.id, severity: "critical", projectId: c.projectId, title: `${c.code}: ${c.safetyImpact ? "safety-impacting" : "critical"} fault on ${asset(c)}`, body: c.problem.slice(0, 160), href: `/cmr/${c.id}`, evidence: [{ ref: c.code, href: `/cmr/${c.id}` }] });
    if (on("CMR_OVERDUE")) {
      const pp = p("CMR_OVERDUE");
      const days: Record<string, number> = { CRITICAL: pp.criticalDays, HIGH: pp.highDays, MEDIUM: pp.mediumDays, LOW: pp.lowDays };
      for (const c of open.filter((c) => c.status !== "AWAITING_VERIFICATION")) {
        const due = c.requestedBy ?? new Date(c.reportedAt.getTime() + (days[c.priority] ?? pp.mediumDays) * DAY);
        if (due < now) out.push({ kind: "CMR_OVERDUE", key: c.id, severity: "warning", projectId: c.projectId, title: `${c.code} overdue (${c.priority.toLowerCase()} priority)`, body: `${asset(c)} · due ${due.toISOString().slice(0, 10)}${c.requestedBy ? " (requested date)" : " (priority response time)"}`, href: `/cmr/${c.id}`, evidence: [{ ref: c.code, href: `/cmr/${c.id}` }] });
      }
    }
    if (on("CMR_VERIFICATION_PENDING")) {
      const { days } = p("CMR_VERIFICATION_PENDING");
      for (const c of open.filter((c) => c.status === "AWAITING_VERIFICATION" && now.getTime() - (c.completedAt ?? c.updatedAt).getTime() > days * DAY))
        out.push({ kind: "CMR_VERIFICATION_PENDING", key: c.id, severity: "warning", projectId: c.projectId, title: `${c.code} awaiting return-to-service verification`, body: asset(c), href: `/cmr/${c.id}`, evidence: [{ ref: c.code, href: `/cmr/${c.id}` }] });
    }
    if (on("CMR_REPEAT_FAULT")) {
      const { threshold, windowDays } = p("CMR_REPEAT_FAULT");
      const recent = cmrs.filter((c) => c.equipmentId && c.status !== "CANCELLED" && c.reportedAt.getTime() >= now.getTime() - windowDays * DAY);
      const byAsset = new Map<string, typeof recent>();
      for (const c of recent) byAsset.set(c.equipmentId!, [...(byAsset.get(c.equipmentId!) ?? []), c]);
      for (const [eq, list] of byAsset) {
        if (list.length < threshold) continue;
        out.push({ kind: "CMR_REPEAT_FAULT", key: eq, severity: "warning", title: `${asset(list[0])}: ${list.length} CMRs in ${windowDays} days`, body: `Threshold ${threshold}. ${list.map((c) => c.code).join(", ")}`, href: `/cmr?equipmentId=${eq}`, evidence: list.map((c) => ({ ref: c.code, href: `/cmr/${c.id}`, note: `${c.reportedAt.toISOString().slice(0, 10)} – ${c.problem.slice(0, 80)}` })) });
      }
    }
  }

  if (on("EQUIPMENT_UNAVAILABLE")) {
    const eq = await db.equipment.findMany({ where: { active: true, status: "OUT_OF_SERVICE" }, select: { id: true, assetNo: true, description: true, statusNote: true } });
    for (const e of eq) out.push({ kind: "EQUIPMENT_UNAVAILABLE", key: e.id, severity: "warning", title: `${e.assetNo} ${e.description} out of service`, body: e.statusNote ?? undefined, href: `/documents?tab=calibration`, evidence: [{ ref: e.assetNo, note: e.statusNote ?? undefined }] });
  }

  if (on("REPEAT_NCR")) {
    const { threshold, windowDays } = p("REPEAT_NCR");
    const ncrs = await db.ncr.findMany({ where: { raisedAt: { gte: new Date(now.getTime() - windowDays * DAY) }, status: { not: "CANCELLED" } }, select: { id: true, code: true, defectCategory: true, projectId: true, project: { select: { code: true } } } });
    const groups = new Map<string, typeof ncrs>();
    for (const n of ncrs) groups.set(`${n.projectId}:${n.defectCategory}`, [...(groups.get(`${n.projectId}:${n.defectCategory}`) ?? []), n]);
    for (const [k, list] of groups) {
      if (list.length < threshold) continue;
      out.push({ kind: "REPEAT_NCR", key: k, severity: "warning", projectId: list[0].projectId, title: `${list[0].project.code}: ${list.length} NCRs for ${list[0].defectCategory} in ${windowDays} days`, body: list.map((n) => n.code).join(", "), href: `/ncr?projectId=${list[0].projectId}`, evidence: list.map((n) => ({ ref: n.code, href: `/ncr/${n.id}` })) });
    }
  }

  if (on("REWORK_AWAITING_INSPECTION")) {
    const { days } = p("REWORK_AWAITING_INSPECTION");
    const reps = await db.repair.findMany({ where: { reinspectionResult: "PENDING", performedAt: { not: null, lt: new Date(now.getTime() - days * DAY) } }, select: { id: true, code: true, description: true, projectId: true, project: { select: { code: true } } } });
    for (const r of reps) out.push({ kind: "REWORK_AWAITING_INSPECTION", key: r.id, severity: "warning", projectId: r.projectId, title: `${r.code} awaiting re-inspection`, body: `${r.project.code} · ${r.description.slice(0, 120)}`, href: `/rework?projectId=${r.projectId}`, evidence: [{ ref: r.code }] });
  }
  return out;
}
