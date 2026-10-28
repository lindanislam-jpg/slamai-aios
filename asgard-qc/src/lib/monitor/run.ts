import { Prisma, type SystemCheckRun } from "@prisma/client";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { permissionsFor } from "../permissions";
import { nextCode } from "../sequence";
import { OPEN_ALERT } from "../services/alerts";
import { assertCan, transaction } from "../services/base";
import { runNotificationScan } from "../services/notifications";
import { getSetting } from "../settings";
import { CHECKS, redact, type CheckContext, type CheckDef, type CheckResult } from "./checks";
import { DEFAULT_SLOTS, nextSlot, planTick, type Slot } from "./schedule";

/**
 * Scheduled whole-system review. Reads and validates records, evaluates the
 * alert rules, stores a report and notifies in-app. It never approves,
 * closes, releases, deletes or rewrites quality records.
 */

const STALE_RUNNING_MS = 15 * 60_000;

export interface RunOptions {
  kind: "SCHEDULED" | "MANUAL" | "RETRY";
  runKey: string;
  triggeredBy: string;
  slot?: Slot | null;
  retryOfId?: string | null;
  /** Test hook: replace the check list (e.g. to simulate a failing service). */
  checks?: CheckDef[];
  now?: Date;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} did not respond within ${Math.round(ms / 1000)} s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Mark runs left RUNNING by a crashed or timed-out invocation as failed. */
export async function failStaleRuns(now = new Date()) {
  const stale = await db.systemCheckRun.findMany({ where: { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }, select: { id: true } });
  if (stale.length) await db.systemCheckRun.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "FAILED", health: "FAILED", finishedAt: now, error: "Interrupted: the run did not finish (host timeout or restart). It can be retried." } });
  return stale.length;
}

export async function runReview(opts: RunOptions): Promise<{ run: SystemCheckRun | null; skipped?: string }> {
  const now = opts.now ?? new Date();
  const cfg = await getSetting("systemMonitor");
  let run: SystemCheckRun;
  try {
    run = await transaction(async (tx) =>
      tx.systemCheckRun.create({
        data: {
          code: await nextCode(tx, "SYS", 5), runKey: opts.runKey, kind: opts.kind, triggeredBy: opts.triggeredBy, retryOfId: opts.retryOfId ?? null,
          slotDate: opts.slot?.date ?? null, slotTime: opts.slot?.time ?? null, scheduledFor: opts.slot?.at ?? null, startedAt: now,
        },
      }),
    );
  } catch (e) {
    // The unique run key is the duplicate-run guard: this slot already ran (or is running).
    if (isUnique(e)) return { run: null, skipped: `Run ${opts.runKey} already exists.` };
    throw e;
  }

  const previous = await db.systemCheckRun.findFirst({ where: { id: { not: run.id }, status: { in: ["COMPLETED", "PARTIAL"] } }, orderBy: { startedAt: "desc" } });
  const timeoutMs = cfg.checkTimeoutSeconds * 1000;
  const ctx: CheckContext = { runCode: run.code, now, previousStartedAt: previous?.startedAt ?? null, conditions: [], alertTally: null, alertOverdueDays: cfg.alertOverdueDays };
  const results: CheckResult[] = [];
  let fatal: string | null = null;

  try {
    // Alert rules first: the quality checks reuse the conditions they evaluated.
    try {
      const scan = await withTimeout(runNotificationScan(now), timeoutMs * 2, "Alert rule scan");
      ctx.conditions = scan.conditionList;
      ctx.alertTally = scan.alerts;
    } catch (e) {
      results.push({ key: "a.scan", group: "alerts", label: "Alert rule scan", status: "ERROR", detail: redact(e instanceof Error ? e.message : String(e)) });
    }
    for (const c of opts.checks ?? CHECKS) {
      const t = Date.now();
      try {
        const r = await withTimeout(c.run(ctx), timeoutMs, c.label);
        results.push({ key: c.key, group: c.group, label: c.label, ms: Date.now() - t, ...r });
      } catch (e) {
        const detail = redact(e instanceof Error ? e.message : String(e));
        results.push({ key: c.key, group: c.group, label: c.label, ms: Date.now() - t, status: c.fatal ? "FAIL" : "ERROR", detail: c.fatal ? `Could not complete: ${detail}` : `Check could not be completed: ${detail}` });
        if (c.fatal) {
          fatal = `${c.label} failed: ${detail}`;
          break;
        }
      }
    }
  } catch (e) {
    fatal = redact(e instanceof Error ? e.message : String(e));
  }

  try {
    return { run: await finishRun(run, results, ctx, previous, fatal, cfg, now) };
  } catch (e) {
    const msg = redact(e instanceof Error ? e.message : String(e));
    const failed = await db.systemCheckRun.update({ where: { id: run.id }, data: { status: "FAILED", health: "FAILED", finishedAt: new Date(), durationMs: Date.now() - now.getTime(), checks: results as unknown as Prisma.InputJsonValue, error: `Report could not be saved: ${msg}` } }).catch(() => run);
    return { run: failed };
  }
}

type Cfg = Awaited<ReturnType<typeof getSetting<"systemMonitor">>>;

async function finishRun(run: SystemCheckRun, results: CheckResult[], ctx: CheckContext, previous: SystemCheckRun | null, fatal: string | null, cfg: Cfg, now: Date) {
  const app = results.filter((r) => r.group === "application");
  const tech = (keys: string[]) => {
    const rs = results.filter((r) => keys.includes(r.key));
    return rs.some((r) => r.status === "FAIL") ? "FAIL" : rs.some((r) => r.status === "ERROR") ? "ERROR" : rs.some((r) => r.status === "WARN") ? "WARN" : rs.length ? "PASS" : "NOT RUN";
  };
  const health = fatal ? "FAILED" : app.some((r) => r.status === "FAIL") ? "CRITICAL" : app.some((r) => r.status === "WARN" || r.status === "ERROR") ? "WARNING" : "HEALTHY";
  const notRun = results.filter((r) => r.status === "ERROR").length;
  const status = fatal ? "FAILED" : notRun ? "PARTIAL" : "COMPLETED";

  const [openBySev, newAlerts, reopened, overdueActions, openNcrs, openCmrs] = await Promise.all([
    db.qualityAlert.groupBy({ by: ["severity"], where: { status: { in: OPEN_ALERT } }, _count: true }),
    db.qualityAlert.findMany({ where: { firstRaisedAt: { gte: run.startedAt } }, select: { id: true, code: true, title: true, severity: true, project: { select: { code: true } } } }),
    db.auditEvent.count({ where: { action: "alert.reopen", at: { gte: run.startedAt } } }),
    db.correctiveAction.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
    db.ncr.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
    db.cmr.count({ where: { status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } } }),
  ]).catch(() => [[], [], 0, 0, 0, 0] as const);
  const sev = (s: string) => openBySev.find((o) => o.severity === s)?._count ?? 0;
  const count = (key: string) => results.find((r) => r.key === key)?.count ?? 0;
  const counts = {
    overdueInspections: ctx.conditions.filter((c) => c.kind === "INSPECTION_OVERDUE").length,
    failedNoNcr: count("q.failed"),
    openNcrs,
    overdueNcrs: ctx.conditions.filter((c) => c.kind === "NCR_OVERDUE").length,
    overdueActions,
    openCmrs,
    overdueCmrs: ctx.conditions.filter((c) => c.kind === "CMR_OVERDUE").length,
    materialIssues: count("q.materials"),
    ndtOutstanding: count("q.ndt"),
    reworkAwaiting: count("q.rework"),
    calibrationDue: count("q.calibration"),
    evidenceMissing: count("q.evidence"),
    releaseBlockers: count("q.release"),
    integrityIssues: results.filter((r) => r.group === "integrity" && (r.status === "FAIL" || r.status === "WARN")).reduce((s, r) => s + (r.count ?? 1), 0),
  };
  const critical = sev("CRITICAL");
  const high = sev("HIGH");
  const qualityStatus = critical ? "CRITICAL" : high || counts.overdueNcrs || counts.overdueActions || counts.failedNoNcr ? "ATTENTION" : "CLEAR";
  const projects = new Set<string>();
  for (const r of results) for (const i of r.items ?? []) if (i.project && r.status !== "PASS") projects.add(i.project);
  for (const a of newAlerts) if (a.project) projects.add(a.project.code);

  const summary = {
    health, qualityStatus,
    technical: { database: tech(["app.database", "app.migrations"]), storage: tech(["app.storage"]), jobs: tech(["app.scheduler", "app.reports"]), integrity: tech(results.filter((r) => r.group === "integrity").map((r) => r.key)) },
    counts,
    alerts: { raised: ctx.alertTally?.raised ?? 0, reopened: ctx.alertTally?.reopened ?? reopened, cleared: ctx.alertTally?.cleared ?? 0, open: { CRITICAL: critical, HIGH: high, MEDIUM: sev("MEDIUM"), LOW: sev("LOW"), INFO: sev("INFO") }, newHighOrCritical: newAlerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").map((a) => ({ id: a.id, code: a.code, title: a.title, severity: a.severity })) },
    projectsAffected: [...projects].sort(),
  };

  // Changes since the previous successful review.
  const prevCounts = ((previous?.summary as { counts?: Record<string, number> } | null)?.counts ?? null);
  const prevFailing = new Set(((previous?.checks as CheckResult[] | null) ?? []).filter((r) => r.status !== "PASS" && r.status !== "SKIPPED").map((r) => r.key));
  const changes = {
    previousRunId: previous?.id ?? null,
    previousCode: previous?.code ?? null,
    counts: prevCounts ? Object.fromEntries(Object.entries(counts).filter(([k, v]) => prevCounts[k] !== undefined && prevCounts[k] !== v).map(([k, v]) => [k, { before: prevCounts[k], after: v }])) : {},
    newProblems: results.filter((r) => (r.status === "FAIL" || r.status === "WARN" || r.status === "ERROR") && !prevFailing.has(r.key)).map((r) => r.label),
    resolvedProblems: previous ? results.filter((r) => r.status === "PASS" && prevFailing.has(r.key)).map((r) => r.label) : [],
    recordsChanged: results.find((r) => r.key === "q.changes")?.count ?? null,
  };

  const actions = results
    .filter((r) => r.status === "FAIL" || r.status === "ERROR" || r.status === "WARN")
    .sort((a, b) => ["FAIL", "ERROR", "WARN"].indexOf(a.status) - ["FAIL", "ERROR", "WARN"].indexOf(b.status))
    .map((r) => ({ priority: r.status === "WARN" ? "normal" : "high", text: `${r.label}: ${r.detail}`, links: (r.items ?? []).slice(0, 5).filter((i) => i.href).map((i) => ({ ref: i.ref, href: i.href! })) }));

  const tallies = {
    passed: results.filter((r) => r.status === "PASS").length,
    warnings: results.filter((r) => r.status === "WARN").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    notRun,
  };
  const finished = await db.systemCheckRun.update({
    where: { id: run.id },
    data: {
      status, health, qualityStatus, finishedAt: new Date(), durationMs: Date.now() - now.getTime(), ...tallies,
      checks: results as unknown as Prisma.InputJsonValue, summary: summary as unknown as Prisma.InputJsonValue,
      changes: changes as unknown as Prisma.InputJsonValue, actions: actions as unknown as Prisma.InputJsonValue, error: fatal,
    },
  });
  const notifications = await notify(finished, summary, changes, cfg).catch((e) => [{ channel: "in-app", outcome: `failed: ${redact(String(e))}` }]);
  await db.systemCheckRun.update({ where: { id: run.id }, data: { notifications: notifications as unknown as Prisma.InputJsonValue } });
  await applyRetention(cfg.retentionDays, now).catch(() => undefined);
  return { ...finished, notifications: notifications as unknown as Prisma.JsonValue };
}

/** In-app notifications only — no email provider is configured. Unchanged
 *  warnings are not re-sent when "notify on changes" is selected. */
async function notify(run: SystemCheckRun, summary: { health: string; qualityStatus: string; alerts: { newHighOrCritical: { severity: string }[] } }, changes: { newProblems: string[] }, cfg: Cfg) {
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, role: true } });
  const overrides = await getSetting("rolePermissions");
  const recipients = users.filter((u) => cfg.recipientUserIds.includes(u.id) || u.role === "ADMIN").filter((u) => permissionsFor(u.role, overrides).has("system.view"));
  const failed = run.status === "FAILED" || run.status === "PARTIAL";
  const newCritical = summary.alerts.newHighOrCritical.filter((a) => a.severity === "CRITICAL").length;
  const changed = changes.newProblems.length > 0 || summary.alerts.newHighOrCritical.length > 0 || failed;
  const log: { channel: string; outcome: string; recipients?: number }[] = [];
  const when = run.slotTime ? `${run.slotTime} review` : `${run.kind.toLowerCase()} review`;

  if (cfg.notifyOn === "every" || changed) {
    const title = `${when}: system ${run.health?.toLowerCase()}, quality ${run.qualityStatus?.toLowerCase()}`;
    const body = [failed ? `Run ${run.status.toLowerCase()}.` : null, changes.newProblems.length ? `New: ${changes.newProblems.slice(0, 4).join("; ")}` : null, `${run.passed} passed · ${run.warnings} warnings · ${run.failed} failed · ${run.notRun} not run`].filter(Boolean).join(" ");
    for (const u of recipients) {
      await db.notification.upsert({
        where: { userId_dedupeKey: { userId: u.id, dedupeKey: `SYSTEM_REVIEW:${run.id}` } },
        create: { userId: u.id, dedupeKey: `SYSTEM_REVIEW:${run.id}`, kind: "SYSTEM_REVIEW", severity: failed || run.health === "CRITICAL" ? "critical" : run.warnings ? "warning" : "info", title, body, href: `/system/${run.id}` },
        update: {},
      });
    }
    log.push({ channel: "in-app", recipients: recipients.length, outcome: "stored in each recipient's notification centre" });
  } else {
    log.push({ channel: "in-app", recipients: 0, outcome: "not sent — no new issues since the previous review" });
  }
  if (cfg.escalateCritical && (run.health === "CRITICAL" || run.status === "FAILED" || newCritical)) {
    const admins = recipients;
    for (const u of admins) {
      await db.notification.upsert({
        where: { userId_dedupeKey: { userId: u.id, dedupeKey: `SYSTEM_ESCALATION:${run.id}` } },
        create: { userId: u.id, dedupeKey: `SYSTEM_ESCALATION:${run.id}`, kind: "SYSTEM_ESCALATION", severity: "critical", title: `Escalation from ${when}: ${run.status === "FAILED" ? "review failed" : run.health === "CRITICAL" ? "critical technical failure" : `${newCritical} new critical quality alert(s)`}`, href: `/system/${run.id}` },
        update: {},
      });
    }
    log.push({ channel: "in-app escalation", recipients: admins.length, outcome: "stored" });
  }
  log.push({ channel: "email", outcome: "not configured — nothing sent" });
  return log;
}

async function applyRetention(days: number, now: Date) {
  await db.systemCheckRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - days * 86_400_000) }, status: { not: "RUNNING" } } });
}

// ─────────────────────────── entry points ───────────────────────────

/** Called by the host scheduler (and opportunistically on page load). Runs
 *  the due Dublin slot once; records slots that were missed. */
export async function tickSchedule(now = new Date(), triggeredBy = "scheduler", opts: { fromHostScheduler?: boolean } = {}) {
  const cfg = await getSetting("systemMonitor");
  // Only real scheduler calls count as a heartbeat, so a silent host scheduler
  // is visible even while page loads keep the reviews running.
  if (opts.fromHostScheduler !== false) await db.setting.upsert({ where: { key: "lastSchedulerTick" }, create: { key: "lastSchedulerTick", value: now.toISOString() }, update: { value: now.toISOString() } });
  if (!cfg.enabled) return { action: "disabled" as const };
  let since = cfg.enabledSince ? new Date(cfg.enabledSince) : null;
  if (!since) {
    // First ever tick: the slot in progress still runs; nothing earlier counts as missed.
    since = new Date(now.getTime() - cfg.catchUpHours * 3_600_000);
    await db.setting.upsert({ where: { key: "systemMonitor" }, create: { key: "systemMonitor", value: { ...cfg, enabledSince: since.toISOString() } }, update: { value: { ...cfg, enabledSince: since.toISOString() } } });
  }
  await failStaleRuns(now);
  const recent = await db.systemCheckRun.findMany({ where: { startedAt: { gte: new Date(now.getTime() - 4 * 86_400_000) } }, select: { runKey: true } });
  const done = new Set(recent.map((r) => r.runKey));
  const plan = planTick(now, done, { catchUpHours: cfg.catchUpHours, since });
  for (const m of plan.missed) {
    await db.systemCheckRun.create({ data: { code: await nextCode(db, "SYS", 5), runKey: m.key, kind: "SCHEDULED", status: "MISSED", health: null, triggeredBy, slotDate: m.date, slotTime: m.time, scheduledFor: m.at, startedAt: m.at, finishedAt: now, error: `No run started within ${cfg.catchUpHours} h of the scheduled time (host scheduler did not call, or the application was unavailable).` } }).catch((e) => { if (!isUnique(e)) throw e; });
  }
  if (!plan.due) return { action: "nothing-due" as const, missed: plan.missed.length };
  const running = await db.systemCheckRun.findFirst({ where: { status: "RUNNING" }, select: { code: true } });
  if (running) return { action: "busy" as const, detail: `${running.code} still running; the slot will be picked up by the next call within the catch-up window.` };
  const r = await runReview({ kind: "SCHEDULED", runKey: plan.due.key, triggeredBy, slot: plan.due, now });
  return { action: r.run ? ("ran" as const) : ("skipped" as const), runId: r.run?.id, detail: r.skipped, missed: plan.missed.length };
}

export async function runManual(actor: Actor) {
  assertCan(actor, "settings.manage");
  await failStaleRuns();
  if (await db.systemCheckRun.findFirst({ where: { status: "RUNNING" }, select: { id: true } })) throw new ValidationError("A review is already running. Wait for it to finish.");
  const r = await runReview({ kind: "MANUAL", runKey: `manual:${new Date().toISOString()}`, triggeredBy: actor.name });
  if (r.run) await recordEvent(db, actor, "system.review.manual", "SystemCheckRun", r.run.id, { summary: `${r.run.code} manual review` });
  return r.run!;
}

export async function retryRun(actor: Actor, id: string) {
  assertCan(actor, "settings.manage");
  const orig = await db.systemCheckRun.findUnique({ where: { id } });
  if (!orig) throw new ValidationError("Run not found.");
  if (!["FAILED", "PARTIAL", "MISSED"].includes(orig.status)) throw new ValidationError("Only failed, partial or missed runs can be retried.");
  if (await db.systemCheckRun.findFirst({ where: { status: "RUNNING" }, select: { id: true } })) throw new ValidationError("A review is already running.");
  const base = orig.runKey.split("#")[0];
  const n = (await db.systemCheckRun.count({ where: { runKey: { startsWith: `${base}#retry-` } } })) + 1;
  const r = await runReview({ kind: "RETRY", runKey: `${base}#retry-${n}`, triggeredBy: actor.name, retryOfId: orig.id, slot: orig.slotDate && orig.slotTime && orig.scheduledFor ? { key: base, date: orig.slotDate, time: orig.slotTime, at: orig.scheduledFor } : null });
  if (r.run) await recordEvent(db, actor, "system.review.retry", "SystemCheckRun", r.run.id, { summary: `${r.run.code} retry of ${orig.code}` });
  return r.run!;
}

export async function monitorStatus(now = new Date()) {
  const [cfg, latest, lastGood, tick, running] = await Promise.all([
    getSetting("systemMonitor"),
    db.systemCheckRun.findFirst({ where: { status: { not: "MISSED" } }, orderBy: { startedAt: "desc" } }),
    db.systemCheckRun.findFirst({ where: { status: { in: ["COMPLETED", "PARTIAL"] } }, orderBy: { startedAt: "desc" } }),
    db.setting.findUnique({ where: { key: "lastSchedulerTick" } }),
    db.systemCheckRun.findFirst({ where: { status: "RUNNING" }, select: { id: true, code: true, startedAt: true } }),
  ]);
  const lastTick = tick ? new Date(tick.value as string) : null;
  return {
    enabled: cfg.enabled, cfg, slots: DEFAULT_SLOTS, next: nextSlot(now), latest, lastGood, lastTick, running,
    // The scheduler calls at least twice in every slot hour; > 8 h of silence means it is not being called.
    schedulerSilent: !lastTick || now.getTime() - lastTick.getTime() > 8 * 3_600_000,
  };
}

export async function updateMonitorSettings(actor: Actor, raw: Record<string, unknown>) {
  assertCan(actor, "settings.manage");
  const cfg = await getSetting("systemMonitor");
  const next = {
    ...cfg,
    enabled: raw.enabled === "on" || raw.enabled === true,
    catchUpHours: Number(raw.catchUpHours ?? cfg.catchUpHours),
    checkTimeoutSeconds: Number(raw.checkTimeoutSeconds ?? cfg.checkTimeoutSeconds),
    retentionDays: Number(raw.retentionDays ?? cfg.retentionDays),
    alertOverdueDays: Number(raw.alertOverdueDays ?? cfg.alertOverdueDays),
    recipientUserIds: (Array.isArray(raw.recipientUserIds) ? raw.recipientUserIds : raw.recipientUserIds ? [raw.recipientUserIds] : []).map(String),
    notifyOn: raw.notifyOn === "every" ? ("every" as const) : ("changes" as const),
    escalateCritical: raw.escalateCritical === "on" || raw.escalateCritical === true,
    // Re-enabling starts a fresh "since" so the disabled period is not reported as missed.
    enabledSince: !cfg.enabled && (raw.enabled === "on" || raw.enabled === true) ? new Date().toISOString() : cfg.enabledSince,
  };
  const { updateSetting } = await import("../services/settings");
  return updateSetting(actor, "systemMonitor", next);
}

/** Safety net on page load: at most every 10 minutes, run a due slot the host
 *  scheduler did not trigger. Never blocks the page (called from after()). */
export async function pageLoadTick(now = new Date()) {
  const row = await db.setting.findUnique({ where: { key: "lastPageTick" } });
  if (row && now.getTime() - new Date(row.value as string).getTime() < 10 * 60_000) return null;
  await db.setting.upsert({ where: { key: "lastPageTick" }, create: { key: "lastPageTick", value: now.toISOString() }, update: { value: now.toISOString() } });
  return tickSchedule(now, "page-load safety net", { fromHostScheduler: false });
}
