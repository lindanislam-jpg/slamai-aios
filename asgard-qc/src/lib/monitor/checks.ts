import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { aiStatus } from "../ai/vision";
import { db } from "../db";
import { qmsStatus } from "../integrations/qms";
import { computeKpis } from "../kpi";
import type { Condition } from "../services/alert-rules";
import { OPEN_ALERT } from "../services/alerts";
import { OPEN_NCR } from "../services/ncrs";
import { evaluateRelease, loadReleaseContext } from "../services/release";
import { emailStatus } from "../email";
import { getSetting } from "../settings";
import { storage } from "../storage";

/**
 * The individual checks of the scheduled review. Every check only READS
 * records (the storage probe writes and removes its own probe file); none
 * approves, closes, deletes or rewrites quality data.
 */

export type CheckGroup = "application" | "integrity" | "quality" | "alerts";
/** ERROR = the check could not be completed (exception or time limit) — never counted as passed. */
export type CheckStatus = "PASS" | "WARN" | "FAIL" | "ERROR" | "SKIPPED";

export interface CheckItem { ref: string; href?: string; note?: string; project?: string }
export interface CheckResult {
  key: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail: string;
  ms?: number;
  count?: number;
  items?: CheckItem[];
}

export interface CheckContext {
  runCode: string;
  now: Date;
  previousStartedAt: Date | null;
  conditions: Condition[];
  alertTally: { raised: number; reopened: number; updated: number; cleared: number } | null;
  alertOverdueDays: number;
}

type CheckFn = (ctx: CheckContext) => Promise<Omit<CheckResult, "key" | "group" | "label" | "ms">>;
export interface CheckDef { key: string; group: CheckGroup; label: string; fatal?: boolean; run: CheckFn }

const DAY = 86_400_000;
const LIST = 25;

/** Keep secrets out of stored error text: connection strings, tokens, keys. */
export function redact(text: string) {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s@/]+@[^\s'"]+/gi, "[redacted-url]")
    .replace(/\b(Bearer|token|apikey|api_key|password|secret)\b[=:\s]+\S+/gi, "$1 [redacted]")
    .replace(/\b(sk-|vercel_blob_rw_)[A-Za-z0-9_-]{8,}/g, "[redacted-key]")
    .replace(/\b[A-Za-z0-9+/_-]{40,}\b/g, "[redacted]")
    .slice(0, 1000);
}

const byKind = (ctx: CheckContext, ...kinds: string[]) => ctx.conditions.filter((c) => kinds.includes(c.kind));
const asItems = (cs: Condition[]) => cs.slice(0, LIST).map((c) => ({ ref: c.title, href: c.href, note: c.body }));
const counted = (n: number, ok: string, bad: string) => (n ? bad.replace("{n}", String(n)) : ok);

// ─────────────────────────── application health ───────────────────────────

const application: CheckDef[] = [
  {
    key: "app.database", group: "application", label: "Database connectivity", fatal: true,
    run: async () => {
      const t = Date.now();
      await db.$queryRaw`SELECT 1`;
      const ms = Date.now() - t;
      return { status: ms > 3000 ? "WARN" : "PASS", detail: `Responded in ${ms} ms${ms > 3000 ? " (slow)" : ""}.` };
    },
  },
  {
    key: "app.migrations", group: "application", label: "Database schema / migrations",
    run: async () => {
      const rows = await db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
      const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at);
      return failed.length
        ? { status: "FAIL", detail: `${failed.length} migration(s) started but not finished.`, items: failed.map((f) => ({ ref: f.migration_name })) }
        : { status: "PASS", detail: `${rows.length} migrations applied, none failed.` };
    },
  },
  {
    key: "app.storage", group: "application", label: "File storage (upload / read)",
    run: async (ctx) => {
      const s = storage();
      const key = `system-check/${ctx.runCode}.txt`;
      const body = Buffer.from(`ASGARD system check ${ctx.runCode} ${ctx.now.toISOString()}`);
      const t = Date.now();
      await s.put(key, body, "text/plain");
      const back = await s.get(key);
      await s.remove(key).catch(() => undefined);
      if (!back.equals(body)) return { status: "FAIL", detail: `Probe file read back differently (${s.driver}).` };
      const local = s.driver === "local" && process.env.VERCEL;
      return { status: local ? "FAIL" : "PASS", detail: local ? "Local disk storage on serverless hosting — files would be lost." : `Write, read and remove succeeded on "${s.driver}" in ${Date.now() - t} ms.` };
    },
  },
  {
    key: "app.reports", group: "application", label: "Report and export services (PDF, Excel)",
    run: async () => {
      const pdf = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4" });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.text("ASGARD system check");
        doc.end();
      });
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet("check").addRow(["ok"]);
      const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
      const failedJobs = await db.reportJob.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - DAY) } } });
      if (!pdf.subarray(0, 4).equals(Buffer.from("%PDF"))) return { status: "FAIL", detail: "PDF renderer produced an invalid file." };
      return { status: failedJobs ? "WARN" : "PASS", detail: `PDF ${pdf.length} B and Excel ${xlsx.length} B rendered.${failedJobs ? ` ${failedJobs} report job(s) failed in the last 24 h.` : ""}`, count: failedJobs };
    },
  },
  {
    key: "app.scheduler", group: "application", label: "Scheduler and background jobs",
    run: async (ctx) => {
      const since = new Date(ctx.now.getTime() - 3 * DAY);
      const [missed, failed, lastScan] = await Promise.all([
        db.systemCheckRun.findMany({ where: { status: "MISSED", startedAt: { gte: since } }, select: { runKey: true } }),
        db.systemCheckRun.findMany({ where: { status: "FAILED", startedAt: { gte: since } }, select: { runKey: true, error: true } }),
        db.setting.findUnique({ where: { key: "lastNotificationScan" } }),
      ]);
      const items = [...missed.map((m) => ({ ref: m.runKey, note: "missed" })), ...failed.map((f) => ({ ref: f.runKey, note: `failed: ${f.error ?? ""}` }))];
      const issues = missed.length + failed.length;
      return { status: issues ? "WARN" : "PASS", count: issues, items, detail: `${counted(missed.length, "No missed runs", "{n} missed run(s)")} and ${counted(failed.length, "no failed runs", "{n} failed run(s)")} in the last 3 days. Last rule scan: ${lastScan ? new Date(lastScan.value as string).toISOString() : "never"}.` };
    },
  },
  {
    key: "app.notifications", group: "application", label: "Notification services",
    run: async () => {
      await db.notification.count({ where: { createdAt: { gte: new Date(Date.now() - DAY) } } });
      const mail = emailStatus();
      const cfg = await getSetting("systemMonitor");
      return { status: "PASS", detail: `In-app notification centre available. Email: ${mail.configured ? `Microsoft 365 configured (sender ${mail.sender}); review emails ${cfg.emailReports ? "on" : "off"}` : "not configured, so nothing is sent by email"}. Not tested by sending.` };
    },
  },
  {
    key: "app.integrations", group: "application", label: "Integrations",
    run: async () => {
      const ai = aiStatus();
      const qms = qmsStatus();
      return { status: "PASS", detail: `AI photo review: ${ai.configured ? `${ai.provider} configured (not called by this check)` : "not configured"}. External QMS: ${qms.label}.` };
    },
  },
  {
    key: "app.config", group: "application", label: "Configuration",
    run: async () => {
      const missing: string[] = [];
      if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) missing.push("BLOB_READ_WRITE_TOKEN (file storage)");
      if (!process.env.ADMIN_EMAIL) missing.push("ADMIN_EMAIL (first administrator)");
      const notes = [process.env.CRON_SECRET ? "Scheduled endpoint protected by CRON_SECRET." : "CRON_SECRET not set: the scheduled endpoint relies on Vercel deployment protection and only ever runs a slot that is due."];
      return { status: missing.length ? "WARN" : "PASS", detail: [missing.length ? `Missing: ${missing.join(", ")}.` : "Required settings present (values not shown).", ...notes].join(" "), items: missing.map((m) => ({ ref: m })) };
    },
  },
  { key: "app.errors", group: "application", label: "Repeated exceptions", run: async () => ({ status: "SKIPPED", detail: "Not monitored here: application error logs are kept by the host (Vercel → project → Logs)." }) },
  { key: "app.backup", group: "application", label: "Recent backup", run: async () => ({ status: "SKIPPED", detail: "Backup monitoring is not configured. Neon keeps point-in-time history; see docs/BACKUP.md." }) },
];

// ─────────────────────────── data integrity ───────────────────────────

const integrity: CheckDef[] = [
  {
    key: "int.states", group: "integrity", label: "Inconsistent statuses and release states",
    run: async () => {
      const [closedWithNcr, releasedWithNcr, undated, passWithFail, verifiedNoCert, cmrUnverified] = await Promise.all([
        db.project.findMany({ where: { status: { in: ["CLOSED", "RELEASED"] }, ncrs: { some: { status: { in: OPEN_NCR } } } }, select: { id: true, code: true, status: true } }),
        db.releaseRecord.findMany({ where: { revokedAt: null, unitId: null, status: "RELEASED", project: { ncrs: { some: { status: { in: OPEN_NCR } } } } }, select: { projectId: true, project: { select: { code: true } } } }),
        db.inspection.findMany({ where: { status: { in: ["SUBMITTED", "REVIEWED", "ACCEPTED"] }, inspectedAt: null }, select: { id: true, code: true, project: { select: { code: true } } }, take: LIST }),
        db.inspection.findMany({ where: { result: "PASS", status: { not: "CANCELLED" }, items: { some: { required: true, result: "FAIL" } } }, select: { id: true, code: true, project: { select: { code: true } } }, take: LIST }),
        db.material.findMany({ where: { certStatus: "VERIFIED", certificateRef: null, certificateDocId: null }, select: { id: true, code: true }, take: LIST }),
        db.cmr.findMany({ where: { status: { in: ["COMPLETED", "CLOSED"] }, verifiedAt: null }, select: { id: true, code: true }, take: LIST }),
      ]);
      const items: CheckItem[] = [
        ...closedWithNcr.map((p) => ({ ref: p.code, href: `/projects/${p.id}`, note: `${p.status.toLowerCase()} with open NCRs`, project: p.code })),
        ...releasedWithNcr.map((r) => ({ ref: r.project.code, href: `/projects/${r.projectId}`, note: "released (no concession) with open NCRs", project: r.project.code })),
        ...undated.map((i) => ({ ref: i.code, href: `/inspections/${i.id}`, note: "submitted with no inspection date", project: i.project.code })),
        ...passWithFail.map((i) => ({ ref: i.code, href: `/inspections/${i.id}`, note: "Pass while a required checklist item failed", project: i.project.code })),
        ...verifiedNoCert.map((m) => ({ ref: m.code, href: `/materials/${m.id}`, note: "certificate verified but no certificate reference or file" })),
        ...cmrUnverified.map((c) => ({ ref: c.code, href: `/cmr/${c.id}`, note: "completed/closed without verification" })),
      ];
      return { status: items.length ? "FAIL" : "PASS", count: items.length, items, detail: counted(items.length, "No inconsistent statuses found.", "{n} record(s) with inconsistent status — review and correct through the normal workflow.") };
    },
  },
  {
    key: "int.duplicates", group: "integrity", label: "Duplicate references",
    run: async () => {
      const dup = await db.unit.groupBy({ by: ["projectId", "ref"], _count: true, having: { ref: { _count: { gt: 1 } } } });
      const projects = dup.length ? await db.project.findMany({ where: { id: { in: dup.map((d) => d.projectId) } }, select: { id: true, code: true } }) : [];
      const items = dup.map((d) => ({ ref: `${projects.find((p) => p.id === d.projectId)?.code} / ${d.ref}`, href: `/projects/${d.projectId}`, note: `${d._count} modules/frames share this reference`, project: projects.find((p) => p.id === d.projectId)?.code }));
      return { status: items.length ? "WARN" : "PASS", count: items.length, items, detail: counted(items.length, "Record codes are unique (enforced by the database); no duplicate module/frame references.", "{n} duplicate module/frame reference(s). Not changed automatically.") };
    },
  },
  {
    key: "int.files", group: "integrity", label: "Records referencing missing files",
    run: async () => {
      const [photos, files, attach, revs] = await Promise.all([
        db.photo.findMany({ where: { deletedAt: null }, orderBy: { uploadedAt: "desc" }, take: 15, select: { id: true, code: true, storageKey: true } }),
        db.projectFile.findMany({ where: { removedAt: null }, orderBy: { uploadedAt: "desc" }, take: 15, select: { code: true, storageKey: true, projectId: true } }),
        db.cmrAttachment.findMany({ orderBy: { uploadedAt: "desc" }, take: 10, select: { fileName: true, storageKey: true, cmrId: true } }),
        db.documentRevision.findMany({ where: { storageKey: { not: null } }, orderBy: { uploadedAt: "desc" }, take: 10, select: { revision: true, storageKey: true, document: { select: { docNo: true } } } }),
      ]);
      const s = storage();
      const targets = [
        ...photos.map((p) => ({ ref: p.code, href: `/photos/${p.id}`, key: p.storageKey })),
        ...files.map((f) => ({ ref: f.code, href: `/projects/${f.projectId}?tab=files`, key: f.storageKey })),
        ...attach.map((a) => ({ ref: a.fileName, href: `/cmr/${a.cmrId}`, key: a.storageKey })),
        ...revs.map((r) => ({ ref: `${r.document.docNo} rev ${r.revision}`, href: "/documents", key: r.storageKey! })),
      ];
      const missing: CheckItem[] = [];
      for (const t of targets) if (!(await s.exists(t.key))) missing.push({ ref: t.ref, href: t.href, note: "stored file not found" });
      return { status: missing.length ? "FAIL" : "PASS", count: missing.length, items: missing, detail: `${targets.length} most recent files sampled; ${counted(missing.length, "all present.", "{n} missing.")}` };
    },
  },
  {
    key: "int.imports", group: "integrity", label: "Incomplete imports",
    run: async () => {
      const [emptyItp, placeholder, draftImports] = await Promise.all([
        db.itpPlan.findMany({ where: { points: { none: {} } }, select: { discipline: true, project: { select: { id: true, code: true } } } }),
        db.project.findMany({ where: { status: { in: ["ACTIVE", "PLANNED"] }, description: { startsWith: "Imported from the SharePoint Large Projects folder name only" } }, select: { id: true, code: true } }),
        db.inspection.count({ where: { status: "DRAFT", comments: { contains: "Historical record transcribed" } } }),
      ]);
      const items = [
        ...emptyItp.map((p) => ({ ref: `${p.project.code} ${p.discipline} ITP`, href: `/projects/${p.project.id}?tab=itp`, note: "applied with no control points", project: p.project.code })),
        ...placeholder.map((p) => ({ ref: p.code, href: `/projects/${p.id}`, note: "details still the import placeholder", project: p.code })),
      ];
      return { status: items.length ? "WARN" : "PASS", count: items.length, items, detail: `${counted(items.length, "No incomplete imports.", "{n} incomplete import(s).")} ${draftImports} transcribed historical inspection(s) await an outcome (left as draft because the original states none).` };
    },
  },
  {
    key: "int.mandatory", group: "integrity", label: "Active projects missing key details",
    run: async () => {
      const rows = await db.project.findMany({ where: { status: "ACTIVE", isDemo: false, OR: [{ targetDate: null }, { customerRef: null }] }, select: { id: true, code: true, targetDate: true, customerRef: true } });
      const items = rows.map((p) => ({ ref: p.code, href: `/projects/${p.id}`, note: [!p.customerRef && "client", !p.targetDate && "target date"].filter(Boolean).join(" and ") + " not recorded", project: p.code }));
      return { status: items.length ? "WARN" : "PASS", count: items.length, items, detail: counted(items.length, "Every active project has a client and target date.", "{n} active project(s) lack a client or target date (overdue tracking needs the target date).") };
    },
  },
  {
    key: "int.kpi", group: "integrity", label: "Dashboard KPIs reconcile with records",
    run: async (ctx) => {
      const k = await computeKpis({ from: new Date(ctx.now.getTime() - 30 * DAY), to: ctx.now, projectId: null, data: "all" });
      const [openNcrs, overdueNcrs, overdueInsp] = await Promise.all([
        db.ncr.count({ where: { status: { in: OPEN_NCR } } }),
        db.ncr.count({ where: { status: { in: OPEN_NCR }, targetDate: { lt: ctx.now } } }),
        db.inspection.count({ where: { status: { in: ["DRAFT", "REJECTED"] }, plannedDate: { lt: ctx.now } } }),
      ]);
      const diffs = [
        ["Open NCRs", k.ncrs.open, openNcrs],
        ["Overdue NCRs", k.ncrs.overdue, overdueNcrs],
        ["Overdue inspections", k.inspections.overdue, overdueInsp],
      ].filter(([, a, b]) => a !== b) as [string, number, number][];
      return { status: diffs.length ? "FAIL" : "PASS", items: diffs.map(([l, a, b]) => ({ ref: l, note: `dashboard ${a}, records ${b}` })), detail: diffs.length ? "Dashboard figures differ from the underlying records." : `Open NCRs ${openNcrs}, overdue NCRs ${overdueNcrs}, overdue inspections ${overdueInsp} — dashboard matches records.` };
    },
  },
  {
    key: "int.refresh", group: "integrity", label: "Data refresh",
    run: async (ctx) => {
      const row = await db.setting.findUnique({ where: { key: "lastNotificationScan" } });
      const last = row ? new Date(row.value as string) : null;
      const stale = !last || ctx.now.getTime() - last.getTime() > DAY;
      return { status: stale ? "WARN" : "PASS", detail: last ? `Rules last evaluated ${last.toISOString()}.` : "Rules have never been evaluated." };
    },
  },
];

// ─────────────────────────── manufacturing quality ───────────────────────────

function conditionCheck(key: string, label: string, kinds: string[], okText: string, badText: string): CheckDef {
  return {
    key, group: "quality", label,
    run: async (ctx) => {
      const cs = byKind(ctx, ...kinds);
      return { status: cs.length ? "WARN" : "PASS", count: cs.length, items: asItems(cs), detail: counted(cs.length, okText, badText) };
    },
  };
}

const quality: CheckDef[] = [
  {
    key: "q.inspections", group: "quality", label: "Overdue and upcoming inspections",
    run: async (ctx) => {
      const overdue = byKind(ctx, "INSPECTION_OVERDUE");
      const upcoming = await db.inspection.count({ where: { status: "DRAFT", plannedDate: { gte: ctx.now, lt: new Date(ctx.now.getTime() + 7 * DAY) } } });
      return { status: overdue.length ? "WARN" : "PASS", count: overdue.length, items: asItems(overdue), detail: `${counted(overdue.length, "No overdue inspections", "{n} overdue inspection(s)")}; ${upcoming} planned in the next 7 days.` };
    },
  },
  conditionCheck("q.failed", "Failed inspections awaiting action", ["FAILED_INSPECTION_NO_NCR"], "Every failed inspection has an NCR.", "{n} failed inspection(s) have no NCR."),
  {
    key: "q.welding", group: "quality", label: "Welding and fabrication defects / evidence",
    run: async (ctx) => {
      const repeat = byKind(ctx, "REPEAT_WELD_DEFECT");
      const noEvidence = await db.weld.findMany({ where: { status: "ACCEPTED", photos: { none: {} } }, select: { id: true, weldRef: true, project: { select: { code: true } } }, take: LIST });
      const items = [...asItems(repeat), ...noEvidence.map((w) => ({ ref: `Weld ${w.weldRef}`, href: `/welding/${w.id}`, note: "accepted with no photo evidence", project: w.project.code }))];
      return { status: repeat.length ? "WARN" : "PASS", count: repeat.length, items, detail: `${counted(repeat.length, "No repeated defect patterns", "{n} repeated defect pattern(s)")}; ${noEvidence.length} accepted weld(s) without photo evidence (only a gap where photos are required).` };
    },
  },
  conditionCheck("q.materials", "Material traceability", ["MATERIAL_HEAT_MISSING", "CERT_MISSING", "MATERIAL_ID_MISMATCH", "QUARANTINE_REVIEW"], "No missing heat numbers, certificates or mismatches.", "{n} material traceability issue(s)."),
  {
    key: "q.ndt", group: "quality", label: "NDT / testing and coating",
    run: async (ctx) => {
      const ndt = byKind(ctx, "NDT_OUTSTANDING");
      const coating = await db.coatingRecord.count({ where: { result: "PENDING" } });
      return { status: ndt.length ? "WARN" : "PASS", count: ndt.length, items: asItems(ndt), detail: `${counted(ndt.length, "No outstanding NDT reports", "{n} NDT report(s) outstanding")}; ${coating} coating inspection(s) awaiting a result.` };
    },
  },
  {
    key: "q.ncr", group: "quality", label: "NCRs",
    run: async (ctx) => {
      const overdue = byKind(ctx, "NCR_OVERDUE");
      const soon = byKind(ctx, "NCR_DUE_SOON");
      const open = await db.ncr.count({ where: { status: { in: OPEN_NCR } } });
      return { status: overdue.length ? "WARN" : "PASS", count: overdue.length, items: asItems([...overdue, ...soon]), detail: `${open} open NCR(s); ${overdue.length} overdue; ${soon.length} due soon.` };
    },
  },
  conditionCheck("q.capa", "CAPA actions and effectiveness checks", ["ACTION_OVERDUE", "NCR_EFFECTIVENESS_DUE", "REPEAT_NCR"], "No overdue actions, effectiveness checks or repeat non-conformances.", "{n} CAPA item(s) need attention."),
  {
    key: "q.cmr", group: "quality", label: "Corrective maintenance (CMR)",
    run: async (ctx) => {
      const cs = byKind(ctx, "CMR_OVERDUE", "CMR_CRITICAL_FAULT", "CMR_REPEAT_FAULT", "CMR_VERIFICATION_PENDING", "EQUIPMENT_UNAVAILABLE");
      const open = await db.cmr.count({ where: { status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } } });
      return { status: cs.length ? "WARN" : "PASS", count: cs.length, items: asItems(cs), detail: `${open} open CMR(s); ${counted(cs.length, "no overdue, critical or repeated faults.", "{n} needing attention.")}` };
    },
  },
  conditionCheck("q.rework", "Rework awaiting verification", ["REWORK_AWAITING_INSPECTION"], "No rework awaiting re-inspection.", "{n} repair(s) awaiting re-inspection."),
  conditionCheck("q.calibration", "Equipment calibration", ["CALIBRATION_DUE"], "No calibration due, expired or missing.", "{n} calibration item(s) due, expired or missing."),
  {
    key: "q.evidence", group: "quality", label: "Project evidence and controlled documents",
    run: async (ctx) => {
      const ev = byKind(ctx, "EVIDENCE_MISSING");
      const unapproved = await db.document.count({ where: { status: { in: ["DRAFT", "UNDER_REVIEW"] } } });
      return { status: ev.length ? "WARN" : "PASS", count: ev.length, items: asItems(ev), detail: `${counted(ev.length, "Required photo categories present on active projects", "{n} active project(s) missing required photo evidence")}; ${unapproved} controlled document(s) not yet approved.` };
    },
  },
  conditionCheck("q.audit", "Audit readiness actions", ["AUDIT_ACTION_DUE"], "No audit findings due or overdue.", "{n} audit finding(s) due or overdue."),
  {
    key: "q.release", group: "quality", label: "Release blockers",
    run: async () => {
      const rules = await getSetting("releaseRules");
      const awaiting = await db.project.findMany({ where: { status: "AWAITING_RELEASE" }, select: { id: true, code: true } });
      const items: CheckItem[] = [];
      for (const p of awaiting) {
        const blocks = evaluateRelease(await loadReleaseContext(p.id), rules).filter((c) => c.state === "FAIL");
        for (const b of blocks) items.push({ ref: p.code, href: `/release?projectId=${p.id}`, note: b.label, project: p.code });
      }
      return { status: items.length ? "WARN" : "PASS", count: items.length, items, detail: awaiting.length ? `${awaiting.length} project(s) awaiting release; ${counted(items.length, "no blockers.", "{n} unmet release condition(s).")}` : "No projects awaiting release." };
    },
  },
  {
    key: "q.changes", group: "quality", label: "Quality records changed since the previous run",
    run: async (ctx) => {
      if (!ctx.previousStartedAt) return { status: "PASS", detail: "First run — no previous run to compare with." };
      const since = { gte: ctx.previousStartedAt };
      const [insp, ncr, cmr, mat, weld, proj] = await Promise.all([
        db.inspection.count({ where: { updatedAt: since } }),
        db.ncr.count({ where: { updatedAt: since } }),
        db.cmr.count({ where: { updatedAt: since } }),
        db.material.count({ where: { updatedAt: since } }),
        db.weld.count({ where: { updatedAt: since } }),
        db.project.count({ where: { updatedAt: since } }),
      ]);
      const total = insp + ncr + cmr + mat + weld + proj;
      return { status: "PASS", count: total, detail: `${total} record(s) changed: inspections ${insp}, NCRs ${ncr}, CMRs ${cmr}, materials ${mat}, welds ${weld}, projects ${proj}.` };
    },
  },
];

// ─────────────────────────── smart quality alerts ───────────────────────────

const alerts: CheckDef[] = [
  {
    key: "a.engine", group: "alerts", label: "Alert rules evaluated",
    run: async (ctx) => {
      if (!ctx.alertTally) return { status: "ERROR", detail: "The alert rule scan did not complete." };
      const t = ctx.alertTally;
      return { status: "PASS", detail: `${t.raised} new, ${t.reopened} reopened, ${t.updated} still active, ${t.cleared} cleared (condition no longer present).` };
    },
  },
  {
    key: "a.priority", group: "alerts", label: "Critical and high alerts unresolved",
    run: async () => {
      const rows = await db.qualityAlert.findMany({ where: { status: { in: OPEN_ALERT }, severity: { in: ["CRITICAL", "HIGH"] } }, orderBy: { firstRaisedAt: "asc" }, select: { id: true, code: true, title: true, severity: true, assignedToName: true, project: { select: { code: true } } } });
      const unassigned = rows.filter((r) => !r.assignedToName).length;
      return { status: rows.length ? "WARN" : "PASS", count: rows.length, items: rows.slice(0, LIST).map((r) => ({ ref: `${r.code} ${r.severity.toLowerCase()}`, href: `/alerts/${r.id}`, note: r.title, project: r.project?.code })), detail: `${rows.length} critical/high alert(s) open; ${unassigned} unassigned.` };
    },
  },
  {
    key: "a.overdue", group: "alerts", label: "Alerts open too long",
    run: async (ctx) => {
      const rows = await db.qualityAlert.findMany({ where: { status: { in: OPEN_ALERT }, firstRaisedAt: { lt: new Date(ctx.now.getTime() - ctx.alertOverdueDays * DAY) } }, select: { id: true, code: true, title: true } });
      return { status: rows.length ? "WARN" : "PASS", count: rows.length, items: rows.slice(0, LIST).map((r) => ({ ref: r.code, href: `/alerts/${r.id}`, note: r.title })), detail: counted(rows.length, `No alert open longer than ${ctx.alertOverdueDays} days.`, `{n} alert(s) open longer than ${ctx.alertOverdueDays} days.`) };
    },
  },
];

export const CHECKS: CheckDef[] = [...application, ...integrity, ...quality, ...alerts];
