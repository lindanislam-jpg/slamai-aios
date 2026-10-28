import type { AlertSeverity, AlertStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { optStr } from "../validation";
import { loadRules, RULE_CATALOGUE, type Condition, type LoadedRule } from "./alert-rules";
import { assertCan, found, transaction } from "./base";

/**
 * Smart Quality Alerts: a persistent, auditable view of the rule conditions.
 *  - One alert per rule per affected record (dedupeKey), never duplicated.
 *  - Open alerts whose condition clears are resolved by the system.
 *  - A resolved or dismissed alert is reopened when its condition clears and
 *    later comes back.
 * Rules are deterministic; nothing here makes a technical acceptance decision.
 */

export const OPEN_ALERT: AlertStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"];
const SEVERITY_ORDER: AlertSeverity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Configured rule severity; a condition the rule itself marks critical
 *  (e.g. calibration expired rather than due soon) is raised to at least High. */
function severityFor(c: Condition, rule?: LoadedRule): AlertSeverity {
  const base = rule?.severity ?? RULE_CATALOGUE[c.kind]?.severity ?? "MEDIUM";
  if (c.severity === "critical" && SEVERITY_ORDER.indexOf(base) < SEVERITY_ORDER.indexOf("HIGH")) return "HIGH";
  return base;
}

export async function syncAlerts(conditions: Condition[], rules: Record<string, LoadedRule>, now = new Date()) {
  const tally = { raised: 0, reopened: 0, updated: 0, cleared: 0 };
  const live = new Map(conditions.map((c) => [`${c.kind}:${c.key}`, c]));
  const existing = await db.qualityAlert.findMany({ where: { dedupeKey: { in: [...live.keys()] } } });
  const byKey = new Map(existing.map((a) => [a.dedupeKey, a]));

  for (const [dedupeKey, c] of live) {
    const rule = rules[c.kind];
    const data = {
      ruleVersion: rule?.version ?? 1,
      category: rule?.category ?? RULE_CATALOGUE[c.kind]?.category ?? "Other",
      severity: severityFor(c, rule),
      title: c.title.slice(0, 300),
      detail: c.body?.slice(0, 2000) ?? null,
      evidence: (c.evidence ?? [{ ref: c.title, href: c.href }]) as Prisma.InputJsonValue,
      href: c.href ?? null,
      projectId: c.projectId ?? null,
      lastSeenAt: now,
    };
    const a = byKey.get(dedupeKey);
    if (!a) {
      await transaction(async (tx) => {
        const code = await nextCode(tx, "QA", 5);
        const row = await tx.qualityAlert.create({ data: { ...data, code, ruleKey: c.kind, dedupeKey, firstRaisedAt: now } });
        await recordEvent(tx, null, "alert.raise", "QualityAlert", row.id, { summary: `${code} ${data.severity} ${c.title}` });
      });
      tally.raised++;
      continue;
    }
    // Closed by a person while the condition was still present: stays closed
    // (the page shows the condition persists). Reopens only once the
    // condition has cleared after closure and then returned.
    const returning = (a.status === "RESOLVED" || a.status === "DISMISSED") && a.conditionClearedAt != null && a.conditionClearedAt >= (a.resolvedAt ?? a.updatedAt);
    if (returning) {
      await transaction(async (tx) => {
        await tx.qualityAlert.update({ where: { id: a.id }, data: { ...data, status: "NEW", conditionClearedAt: null, reopenCount: { increment: 1 }, assignedToName: null, acknowledgedAt: null, acknowledgedByName: null } });
        await recordEvent(tx, null, "alert.reopen", "QualityAlert", a.id, { summary: `${a.code} reopened — condition returned (was ${a.status.toLowerCase()})` });
      });
      tally.reopened++;
    } else {
      await db.qualityAlert.update({ where: { id: a.id }, data: { ...data, conditionClearedAt: null } });
      tally.updated++;
    }
  }

  // Conditions that are no longer present.
  const stale = await db.qualityAlert.findMany({ where: { conditionClearedAt: null, dedupeKey: { notIn: [...live.keys()] } }, select: { id: true, code: true, status: true } });
  for (const a of stale) {
    await transaction(async (tx) => {
      const autoResolve = OPEN_ALERT.includes(a.status);
      await tx.qualityAlert.update({
        where: { id: a.id },
        data: { conditionClearedAt: now, ...(autoResolve ? { status: "RESOLVED", resolvedAt: now, resolvedByName: "System – condition no longer present" } : {}) },
      });
      if (autoResolve) await recordEvent(tx, null, "alert.clear", "QualityAlert", a.id, { summary: `${a.code} resolved — triggering condition no longer present` });
    });
    tally.cleared++;
  }
  return tally;
}

// ───────────── lifecycle (people) ─────────────

const NEXT: Record<AlertStatus, AlertStatus[]> = {
  NEW: ["ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "DISMISSED"],
  ACKNOWLEDGED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "DISMISSED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "DISMISSED"],
  IN_PROGRESS: ["ASSIGNED", "RESOLVED", "DISMISSED"],
  RESOLVED: ["NEW"],
  DISMISSED: ["NEW"],
};
export const alertTransitions = (s: AlertStatus) => NEXT[s];

export const alertMoveInput = z.object({
  status: z.enum(["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
  assignedToName: optStr(200),
  note: optStr(2000),
});

export async function moveAlert(actor: Actor, id: string, raw: z.input<typeof alertMoveInput>) {
  assertCan(actor, "alert.manage");
  const input = alertMoveInput.parse(raw);
  return transaction(async (tx) => {
    const a = found(await tx.qualityAlert.findUnique({ where: { id } }), "Alert");
    if (!NEXT[a.status].includes(input.status)) throw new ValidationError(`An alert that is ${a.status.toLowerCase()} cannot move to ${input.status.toLowerCase()}.`);
    const data: Prisma.QualityAlertUpdateInput = { status: input.status };
    if (input.status === "ACKNOWLEDGED") Object.assign(data, { acknowledgedAt: new Date(), acknowledgedByName: actor.name });
    if (input.status === "ASSIGNED") {
      if (!input.assignedToName) throw new ValidationError("Name the person the alert is assigned to.");
      data.assignedToName = input.assignedToName;
    }
    if (input.status === "RESOLVED") {
      if (!input.note) throw new ValidationError("Record how the alert was resolved.");
      Object.assign(data, { resolvedAt: new Date(), resolvedByName: actor.name, resolutionNote: input.note });
    }
    if (input.status === "DISMISSED") {
      if (!input.note) throw new ValidationError("A reason is required to dismiss an alert.");
      Object.assign(data, { resolvedAt: new Date(), resolvedByName: actor.name, dismissedReason: input.note });
    }
    if (input.status === "NEW") {
      if (!input.note) throw new ValidationError("Give a reason for reopening.");
      Object.assign(data, { reopenCount: { increment: 1 } });
    }
    if (a.status === "NEW" && input.status !== "ACKNOWLEDGED" && input.status !== "NEW" && !a.acknowledgedAt) Object.assign(data, { acknowledgedAt: new Date(), acknowledgedByName: actor.name });
    const row = await tx.qualityAlert.update({ where: { id }, data });
    await recordEvent(tx, actor, "alert.status", "QualityAlert", id, {
      summary: `${a.code}: ${a.status} → ${input.status}${input.assignedToName ? ` (assigned to ${input.assignedToName})` : ""}${input.note ? ` — ${input.note}` : ""}`,
    });
    return row;
  });
}

export interface AlertFilter {
  status?: "open" | "closed" | AlertStatus | null;
  severity?: AlertSeverity | null;
  category?: string | null;
  projectId?: string | null;
}

export async function listAlerts(actor: Actor, f: AlertFilter = {}) {
  assertCan(actor, "records.view");
  const status = f.status === "open" || !f.status ? { in: OPEN_ALERT } : f.status === "closed" ? { in: ["RESOLVED", "DISMISSED"] as AlertStatus[] } : f.status;
  const rows = await db.qualityAlert.findMany({
    where: { status, ...(f.severity ? { severity: f.severity } : {}), ...(f.category ? { category: f.category } : {}), ...(f.projectId ? { projectId: f.projectId } : {}) },
    include: { project: { select: { code: true } } },
    orderBy: [{ firstRaisedAt: "desc" }],
    take: 500,
  });
  return rows.sort((a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity));
}

export async function alertCounts() {
  const open = await db.qualityAlert.groupBy({ by: ["severity"], where: { status: { in: OPEN_ALERT } }, _count: true });
  const by = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, open.find((o) => o.severity === s)?._count ?? 0])) as Record<AlertSeverity, number>;
  const ages = await db.qualityAlert.findMany({ where: { status: { in: OPEN_ALERT } }, select: { firstRaisedAt: true } });
  const now = Date.now();
  const ageing = { "< 7 days": 0, "7–30 days": 0, "> 30 days": 0 };
  for (const a of ages) {
    const d = (now - a.firstRaisedAt.getTime()) / 86_400_000;
    ageing[d < 7 ? "< 7 days" : d <= 30 ? "7–30 days" : "> 30 days"]++;
  }
  return { bySeverity: by, total: ages.length, ageing };
}

export async function getAlert(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const alert = found(await db.qualityAlert.findUnique({ where: { id }, include: { project: { select: { code: true, name: true } } } }), "Alert");
  const [history, rule] = await Promise.all([
    db.auditEvent.findMany({ where: { entityType: "QualityAlert", entityId: id }, orderBy: { at: "desc" } }),
    db.alertRule.findUnique({ where: { key: alert.ruleKey } }),
  ]);
  return { alert, history, rule };
}

// ───────────── rule configuration (administrators) ─────────────

export async function listRules(actor: Actor) {
  assertCan(actor, "records.view");
  await loadRules();
  return db.alertRule.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function updateRule(actor: Actor, key: string, raw: { enabled?: unknown; severity?: unknown; params?: Record<string, unknown> }) {
  assertCan(actor, "settings.manage");
  const def = RULE_CATALOGUE[key];
  if (!def) throw new ValidationError("Unknown rule.");
  const severity = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]).parse(raw.severity);
  const enabled = raw.enabled === true || raw.enabled === "on" || raw.enabled === "true";
  const params: Record<string, number> = {};
  for (const [k, meta] of Object.entries(def.params ?? {})) {
    const v = Number(raw.params?.[k]);
    if (!Number.isFinite(v) || v < 0 || v > 3650 || !Number.isInteger(v)) throw new ValidationError(`${meta.label} must be a whole number from 0 to 3650.`);
    params[k] = v;
  }
  return transaction(async (tx) => {
    const before = found(await tx.alertRule.findUnique({ where: { key } }), "Rule");
    const changed = before.enabled !== enabled || before.severity !== severity || JSON.stringify(before.params ?? {}) !== JSON.stringify(params);
    if (!changed) return before;
    const row = await tx.alertRule.update({ where: { key }, data: { enabled, severity, params, version: { increment: 1 }, updatedByName: actor.name } });
    await recordEvent(tx, actor, "alert.rule", "AlertRule", row.id, {
      summary: `${def.name} v${row.version}`,
      before: { enabled: before.enabled, severity: before.severity, params: before.params },
      after: { enabled, severity, params },
    });
    return row;
  });
}
