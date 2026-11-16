import { db } from "./db";
import type { Actor, Permission } from "./permissions";
import { OPEN_ALERT } from "./services/alerts";
import { OPEN_NCR } from "./services/ncrs";
import { NOTIFICATION_KINDS } from "./services/notifications";

/**
 * "What needs attention now" for the dashboard. Two sources, so nothing is
 * counted twice:
 *  - open Smart Quality Alerts (every rule-detected problem: overdue NCRs and
 *    actions, failed inspections without NCR, calibration, CMRs …), and
 *  - records waiting for a person's decision or action in the normal workflow
 *    (inspections to review, NCRs to verify, planned inspections due).
 * Read-only: it lists work, it never changes a record.
 */

const DAY = 86_400_000;
const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 } as const;
export type AttentionLevel = keyof typeof RANK;

export interface AttentionItem {
  key: string;
  level: AttentionLevel;
  title: string;
  detail: string;
  href: string;
  ageDays: number;
  /** Who normally deals with it. */
  owner: string;
  /** True when the signed-in user's role can act on it. */
  forYou: boolean;
}

const OWNER: Partial<Record<Permission, string>> = {
  "ncr.manage": "Quality Manager",
  "ncr.close": "Quality Manager",
  "inspection.review": "Quality Manager",
  "inspection.write": "Inspector",
  "material.disposition": "Material inspector",
  "weld.confirm": "Welding inspector",
  "ndt.write": "Inspector",
  "calibration.write": "Quality",
  "audit.write": "Quality Manager",
  "release.approve": "Quality Manager",
  "photo.review": "Quality",
  "cmr.work": "Maintenance",
  "cmr.verify": "Quality / supervisor",
};

export async function attentionQueue(actor: Actor, projectId?: string | null) {
  const now = Date.now();
  const age = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((now - d.getTime()) / DAY)) : 0);
  const scope = projectId ? { projectId } : {};
  const [alerts, toReview, toVerify, planned] = await Promise.all([
    db.qualityAlert.findMany({ where: { ...scope, status: { in: OPEN_ALERT }, severity: { in: ["CRITICAL", "HIGH", "MEDIUM"] } }, select: { id: true, code: true, ruleKey: true, severity: true, title: true, detail: true, firstRaisedAt: true, status: true, assignedToName: true } }),
    db.inspection.findMany({ where: { ...scope, status: "SUBMITTED" }, select: { id: true, code: true, type: true, result: true, updatedAt: true, inspectorId: true, project: { select: { code: true } } } }),
    db.ncr.findMany({ where: { ...scope, status: "AWAITING_VERIFICATION" }, select: { id: true, code: true, defectCategory: true, updatedAt: true, project: { select: { code: true } } } }),
    db.inspection.findMany({ where: { ...scope, status: "DRAFT", plannedDate: { lt: new Date(now + DAY) } }, select: { id: true, code: true, type: true, plannedDate: true, reinspectionOfId: true, project: { select: { code: true } } } }),
  ]);
  const can = (p: Permission) => actor.permissions.has(p);
  const items: AttentionItem[] = [];
  for (const a of alerts) {
    const audience = NOTIFICATION_KINDS[a.ruleKey]?.audience ?? "ncr.manage";
    items.push({
      key: `alert:${a.id}`, level: a.severity, title: a.title, detail: `${a.code} · ${a.status === "NEW" ? "not acknowledged" : a.assignedToName ? `with ${a.assignedToName}` : a.status.toLowerCase().replace(/_/g, " ")}`,
      href: `/alerts/${a.id}`, ageDays: age(a.firstRaisedAt), owner: OWNER[audience] ?? "Quality", forYou: can(audience) || can("alert.manage"),
    });
  }
  for (const i of toReview) {
    const waiting = age(i.updatedAt);
    items.push({
      key: `review:${i.id}`, level: i.result === "FAIL" ? "HIGH" : waiting > 3 ? "MEDIUM" : "LOW", title: `${i.code} awaiting review`, detail: `${i.project.code} · ${i.type.replace(/_/g, " ").toLowerCase()} · result ${i.result.toLowerCase()}`,
      href: `/inspections/${i.id}`, ageDays: waiting, owner: "Quality Manager", forYou: can("inspection.review") && i.inspectorId !== actor.id,
    });
  }
  for (const n of toVerify) {
    items.push({ key: `verify:${n.id}`, level: "HIGH", title: `${n.code} awaiting verification and closure`, detail: `${n.project.code} · ${n.defectCategory}`, href: `/ncr/${n.id}`, ageDays: age(n.updatedAt), owner: "Quality Manager", forYou: can("ncr.close") });
  }
  for (const i of planned) {
    const late = age(i.plannedDate);
    items.push({
      key: `planned:${i.id}`, level: late > 0 ? "MEDIUM" : "LOW", title: `${i.code} ${i.reinspectionOfId ? "re-inspection" : "inspection"} ${late > 0 ? "overdue" : "due"}`, detail: `${i.project.code} · ${i.type.replace(/_/g, " ").toLowerCase()}`,
      href: `/inspections/${i.id}`, ageDays: late, owner: "Inspector", forYou: can("inspection.write"),
    });
  }
  items.sort((a, b) => RANK[a.level] - RANK[b.level] || Number(b.forYou) - Number(a.forYou) || b.ageDays - a.ageDays);
  return { items, total: items.length, forYou: items.filter((i) => i.forYou).length, urgent: items.filter((i) => RANK[i.level] <= 1).length };
}

export type Rag = "RED" | "AMBER" | "GREEN";

export interface ProjectHealth {
  id: string;
  code: string;
  name: string;
  client: string | null;
  targetDate: Date | null;
  rag: Rag;
  reasons: string[];
  itp: { plans: number; points: number; done: number };
  inspections: number;
  openNcrs: number;
  overdueNcrs: number;
  alerts: number;
}

/**
 * Red / amber / green for each active project, by fixed rules that are shown
 * with the result. It is a reading of the records, not a judgement:
 *   RED   — an overdue NCR, a Critical alert, or the target date has passed.
 *   AMBER — no ITP applied, no inspection recorded, an open NCR, or a High alert.
 *   GREEN — none of the above.
 */
export async function projectHealth(data: "all" | "real" | "demo" = "all"): Promise<ProjectHealth[]> {
  const now = new Date();
  const projects = await db.project.findMany({
    where: { status: "ACTIVE", ...(data === "all" ? {} : { isDemo: data === "demo" }) },
    orderBy: { code: "asc" },
    select: {
      id: true, code: true, name: true, customerRef: true, targetDate: true,
      _count: { select: { inspections: true } },
      itpPlans: { select: { points: { select: { status: true } } } },
      ncrs: { where: { status: { in: OPEN_NCR } }, select: { targetDate: true } },
      alerts: { where: { status: { in: OPEN_ALERT }, severity: { in: ["CRITICAL", "HIGH"] } }, select: { severity: true } },
    },
  });
  const out = projects.map((p): ProjectHealth => {
    const points = p.itpPlans.flatMap((pl) => pl.points);
    const done = points.filter((pt) => pt.status !== "OPEN").length;
    const overdueNcrs = p.ncrs.filter((n) => n.targetDate && n.targetDate < now).length;
    const critical = p.alerts.filter((a) => a.severity === "CRITICAL").length;
    const high = p.alerts.length - critical;
    const red = [
      overdueNcrs ? `${overdueNcrs} overdue NCR${overdueNcrs > 1 ? "s" : ""}` : null,
      critical ? `${critical} critical alert${critical > 1 ? "s" : ""}` : null,
      p.targetDate && p.targetDate < now ? "target date passed" : null,
    ].filter((r): r is string => !!r);
    const amber = [
      p.itpPlans.length === 0 ? "no ITP" : null,
      p._count.inspections === 0 ? "no inspections recorded" : null,
      p.ncrs.length - overdueNcrs > 0 ? `${p.ncrs.length - overdueNcrs} open NCR${p.ncrs.length - overdueNcrs > 1 ? "s" : ""}` : null,
      high ? `${high} high alert${high > 1 ? "s" : ""}` : null,
    ].filter((r): r is string => !!r);
    return {
      id: p.id, code: p.code, name: p.name, client: p.customerRef, targetDate: p.targetDate,
      rag: red.length ? "RED" : amber.length ? "AMBER" : "GREEN", reasons: [...red, ...amber],
      itp: { plans: p.itpPlans.length, points: points.length, done }, inspections: p._count.inspections, openNcrs: p.ncrs.length, overdueNcrs, alerts: p.alerts.length,
    };
  });
  const order: Record<Rag, number> = { RED: 0, AMBER: 1, GREEN: 2 };
  return out.sort((a, b) => order[a.rag] - order[b.rag] || a.code.localeCompare(b.code));
}
