import type { Inspection, InspectionType, Ncr } from "@prisma/client";
import { recordEvent } from "./audit";
import { db, type Tx } from "./db";
import { permissionsFor, type Actor, type Permission } from "./permissions";
import { nextCode } from "./sequence";
import { getSetting } from "./settings";

/**
 * Quality automation. Each automation only PREPARES work for a person: it
 * raises a record, plans a check or sends a reminder. None of them accepts,
 * rejects, closes or releases anything — those stay with the people whose
 * role allows it. Every automatic step is written to the audit trail under an
 * "automation.*" action, and each can be switched off in System Monitor.
 */

const DAY = 86_400_000;

const CATEGORY_BY_TYPE: Partial<Record<InspectionType, string>> = {
  DIMENSIONAL: "Dimensional",
  INCOMING_MATERIAL: "Material / traceability",
  COATING: "Coating",
};

/** Store one in-app notification for every active user holding a permission. */
async function notifyHolders(client: Tx, permission: Permission, n: { kind: string; dedupeKey: string; severity: string; title: string; body?: string; href?: string }) {
  const [users, overrides] = await Promise.all([client.user.findMany({ where: { active: true }, select: { id: true, role: true, email: true, notificationPrefs: true } }), getSetting("rolePermissions", client)]);
  const to = users.filter((u) => permissionsFor(u.role, overrides).has(permission) && !((u.notificationPrefs as { muted?: string[] } | null)?.muted ?? []).includes(n.kind));
  for (const u of to) {
    await client.notification.upsert({ where: { userId_dedupeKey: { userId: u.id, dedupeKey: n.dedupeKey } }, create: { userId: u.id, ...n }, update: {} });
  }
  return to;
}

/** A failed inspection is submitted → raise the NCR straight away, linked and
 *  pre-filled from the failed checks, so no failure waits for someone to
 *  remember. The Quality Manager investigates, dispositions or cancels it. */
export async function autoNcrForFailedInspection(tx: Tx, actor: Actor, insp: Inspection & { items: { description: string; requirement: string | null; actual: string | null; result: string; notes: string | null }[] }) {
  if (insp.result !== "FAIL" || insp.reinspectionOfId) return null;
  if (!(await getSetting("automation", tx)).autoNcrOnFailedInspection) return null;
  if (await tx.ncr.findFirst({ where: { inspectionId: insp.id }, select: { id: true } })) return null;
  const failed = insp.items.filter((i) => i.result === "FAIL");
  const lines = failed.slice(0, 20).map((i) => `- ${i.description}${i.requirement ? ` (required: ${i.requirement})` : ""}${i.actual ? ` — found: ${i.actual}` : ""}${i.notes ? ` — ${i.notes}` : ""}`);
  const code = await nextCode(tx, "NCR", 4);
  const ncr = await tx.ncr.create({
    data: {
      code,
      projectId: insp.projectId,
      unitId: insp.unitId,
      inspectionId: insp.id,
      componentRef: insp.componentRef,
      drawingRef: insp.drawingRef,
      stageOfDetection: insp.stage,
      detectedBy: insp.inspectorName,
      requirementRef: insp.criteriaRef,
      raisedById: actor.id,
      raisedByName: `${actor.name} (raised automatically)`,
      defectCategory: CATEGORY_BY_TYPE[insp.type] ?? "Other / requires review",
      priority: "MEDIUM",
      description: [
        `Raised automatically when inspection ${insp.code} was submitted with the result Fail.`,
        failed.length ? `Failed checks:\n${lines.join("\n")}` : "No individual check was marked failed; see the inspection comments.",
        "To be reviewed by the Quality Manager: confirm category and priority, then investigate or cancel with a reason.",
      ].join("\n").slice(0, 4000),
      isDemo: insp.isDemo,
    },
  });
  await recordEvent(tx, actor, "automation.ncr_raised", "Ncr", ncr.id, { summary: `${code} raised automatically from failed inspection ${insp.code}` });
  await notifyHolders(tx, "ncr.manage", { kind: "AUTO_NCR_RAISED", dedupeKey: `AUTO_NCR_RAISED:${ncr.id}`, severity: "warning", title: `${code} raised automatically`, body: `Inspection ${insp.code} failed. Review, classify and assign the NCR.`, href: `/ncr/${ncr.id}` });
  return ncr;
}

/** An NCR reaches "awaiting verification" → plan the re-inspection of the
 *  inspection that failed, with the failed checks copied in, so the closing
 *  evidence is not forgotten. The inspector still performs and records it. */
export async function autoReinspectionForNcr(tx: Tx, actor: Actor, ncr: Ncr) {
  if (!ncr.inspectionId) return null;
  const cfg = await getSetting("automation", tx);
  if (!cfg.autoPlanReinspection) return null;
  const orig = await tx.inspection.findUnique({ where: { id: ncr.inspectionId }, include: { items: { orderBy: { order: "asc" } } } });
  if (!orig || orig.status === "CANCELLED") return null;
  if (await tx.inspection.findFirst({ where: { reinspectionOfId: orig.id, status: { in: ["DRAFT", "SUBMITTED"] } }, select: { id: true } })) return null;
  const failed = orig.items.filter((i) => i.result === "FAIL");
  const items = (failed.length ? failed : orig.items).slice(0, 200);
  const code = await nextCode(tx, "INS", 6);
  const re = await tx.inspection.create({
    data: {
      code,
      projectId: orig.projectId,
      unitId: orig.unitId,
      type: orig.type,
      operation: orig.operation,
      stage: orig.stage,
      componentRef: orig.componentRef,
      drawingRef: orig.drawingRef,
      criteriaRef: orig.criteriaRef,
      reinspectionOfId: orig.id,
      plannedDate: new Date(Date.now() + cfg.reinspectionDueDays * DAY),
      comments: `Planned automatically for the verification of ${ncr.code} (re-inspection of ${orig.code}). To be carried out and recorded by an inspector.`,
      isDemo: orig.isDemo,
      items: { create: items.map((i, idx) => ({ order: idx + 1, description: i.description, requirement: i.requirement, criteriaStatus: i.criteriaStatus, tolerance: i.tolerance, unit: i.unit, required: i.required })) },
    },
  });
  await recordEvent(tx, actor, "automation.reinspection_planned", "Inspection", re.id, { summary: `${code} planned automatically: re-inspection of ${orig.code} for ${ncr.code}` });
  await notifyHolders(tx, "inspection.write", { kind: "AUTO_REINSPECTION", dedupeKey: `AUTO_REINSPECTION:${re.id}`, severity: "info", title: `Re-inspection ${code} planned for ${ncr.code}`, body: `Corrective action is complete. Re-inspect ${orig.code} and record the result.`, href: `/inspections/${re.id}` });
  return re;
}

/** A Critical or High alert that nobody has acknowledged after the configured
 *  number of days is escalated to the people who can close NCRs (Quality
 *  Manager, administrators). The alert itself is not changed. */
export async function escalateUnacknowledgedAlerts(now = new Date()) {
  const days = (await getSetting("automation")).escalateUnacknowledgedDays;
  if (!days) return 0;
  const alerts = await db.qualityAlert.findMany({
    where: { status: "NEW", severity: { in: ["CRITICAL", "HIGH"] }, firstRaisedAt: { lt: new Date(now.getTime() - days * DAY) } },
    select: { id: true, code: true, title: true, severity: true, firstRaisedAt: true },
  });
  // The audit trail is the "already escalated" marker, so each alert escalates once.
  const done = new Set((await db.auditEvent.findMany({ where: { action: "automation.alert_escalated", entityId: { in: alerts.map((a) => a.id) } }, select: { entityId: true } })).map((e) => e.entityId));
  const fresh = alerts.filter((a) => !done.has(a.id));
  if (!fresh.length) return 0;
  const age = (a: { firstRaisedAt: Date }) => Math.floor((now.getTime() - a.firstRaisedAt.getTime()) / DAY);
  await db.$transaction(async (tx) => {
    if (fresh.length <= 5) {
      for (const a of fresh) await notifyHolders(tx, "ncr.close", { kind: "ALERT_ESCALATION", dedupeKey: `ALERT_ESCALATION:${a.id}`, severity: "critical", title: `Escalated: ${a.code} not acknowledged for ${age(a)} days`, body: `${a.severity} alert — ${a.title}`, href: `/alerts/${a.id}` });
    } else {
      // A backlog becomes one notification, not dozens.
      const critical = fresh.filter((a) => a.severity === "CRITICAL").length;
      await notifyHolders(tx, "ncr.close", { kind: "ALERT_ESCALATION", dedupeKey: `ALERT_ESCALATION:batch:${now.toISOString().slice(0, 13)}`, severity: "critical", title: `Escalated: ${fresh.length} urgent alerts not acknowledged for ${days}+ days`, body: `${critical} critical, ${fresh.length - critical} high. Oldest: ${fresh.map((a) => a.code).slice(0, 5).join(", ")}…`, href: "/alerts?status=NEW" });
    }
    for (const a of fresh) await recordEvent(tx, null, "automation.alert_escalated", "QualityAlert", a.id, { summary: `${a.code} escalated: ${a.severity}, unacknowledged for ${age(a)} days` });
  });
  return fresh.length;
}

const pc = (v: number | null) => (v == null ? "no data" : `${(v * 100).toFixed(1)}%`);

/** Monday's 09:00 review also writes the weekly quality summary: the last 7
 *  days against the 7 before. Figures come from the same KPI calculation as
 *  the dashboard. Emailed only when Microsoft 365 email is configured and on. */
export async function weeklyDigest(now: Date, slot: { date: string; time: string } | null | undefined) {
  if (!slot || slot.time !== "09:00" || new Date(`${slot.date}T12:00:00Z`).getUTCDay() !== 1) return null;
  if (!(await getSetting("automation")).weeklyDigest) return null;
  const dedupeKey = `WEEKLY_DIGEST:${slot.date}`;
  if (await db.notification.findFirst({ where: { dedupeKey }, select: { id: true } })) return null;
  // Loaded here, not at the top: the KPI module imports the record services that call this file.
  const { computeKpis } = await import("./kpi");
  const [k, prev] = await Promise.all([
    computeKpis({ from: new Date(now.getTime() - 7 * DAY), to: now, data: "real" }),
    computeKpis({ from: new Date(now.getTime() - 14 * DAY), to: new Date(now.getTime() - 7 * DAY), data: "real" }),
  ]);
  const top = k.weldDefects.byCategory[0];
  const lines = [
    `Inspections: ${k.inspections.total} (previous week ${prev.inspections.total}); pass rate ${pc(k.inspections.passRate)} (previous ${pc(prev.inspections.passRate)}); first-pass yield ${pc(k.inspections.firstPassYield)}.`,
    `NCRs: ${k.ncrs.open} open, ${k.ncrs.overdue} overdue. Corrective actions: ${k.actions.open} open, ${k.actions.overdue} overdue.`,
    `Weld defects confirmed: ${k.weldDefects.total}${top ? ` (most frequent: ${top.key.toLowerCase()}, ${top.count})` : ""}. Rework records: ${k.rework.volume}.`,
    `Material exceptions: ${k.materials.exceptions}. Overdue inspections: ${k.inspections.overdue}. NDT reports outstanding: ${k.ndt.outstanding}.`,
  ];
  const title = `Weekly quality summary — week to ${slot.date}`;
  const to = await notifyHolders(db, "system.view", { kind: "WEEKLY_DIGEST", dedupeKey, severity: k.ncrs.overdue || k.actions.overdue ? "warning" : "info", title, body: lines.join(" "), href: "/analytics?period=7" });
  let email = "not sent";
  if ((await getSetting("systemMonitor")).emailReports) {
    const { sendMail } = await import("./email");
    email = (await sendMail(to.map((u) => u.email), `ASGARD QC ${title}`, [title, ...lines, "Automatic summary calculated from application records. It approves nothing."].join("\n\n"))).outcome;
  }
  await db.auditEvent.create({ data: { actorName: "system", action: "automation.weekly_digest", entityType: "Report", entityId: slot.date, summary: `${title}: ${to.length} recipient(s) in-app; email ${email}` } });
  return { recipients: to.length, email };
}

export const AUTOMATION_ACTIONS: Record<string, string> = {
  "automation.ncr_raised": "NCRs raised from failed inspections",
  "automation.reinspection_planned": "Re-inspections planned",
  "automation.alert_escalated": "Alerts escalated",
  "automation.weekly_digest": "Weekly summaries sent",
};

/** What automation did recently, for the dashboard. */
export async function automationActivity(days = 7) {
  const since = new Date(Date.now() - days * DAY);
  const [groups, recent, cfg] = await Promise.all([
    db.auditEvent.groupBy({ by: ["action"], where: { action: { startsWith: "automation." }, at: { gte: since } }, _count: true }),
    db.auditEvent.findMany({ where: { action: { startsWith: "automation." } }, orderBy: { at: "desc" }, take: 5, select: { id: true, action: true, summary: true, at: true, entityType: true, entityId: true } }),
    getSetting("automation"),
  ]);
  const counts = Object.fromEntries(Object.keys(AUTOMATION_ACTIONS).map((a) => [a, groups.find((g) => g.action === a)?._count ?? 0])) as Record<string, number>;
  return { days, counts, recent, cfg };
}
