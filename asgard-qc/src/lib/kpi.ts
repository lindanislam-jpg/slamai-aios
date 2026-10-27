import type { InspectionResult, Prisma, RecordStatus } from "@prisma/client";
import { db } from "./db";
import { getSetting } from "./settings";
import { OPEN_NCR } from "./services/ncrs";
import { countBy } from "./services/welding";

/**
 * KPI definitions. Shown on the dashboard (hover/info) and in exports, so
 * everyone reads the numbers the same way.
 */
export const KPI_DEFINITIONS: Record<string, { label: string; definition: string }> = {
  totalProjects: { label: "Total projects", definition: "Projects not cancelled." },
  activeProjects: { label: "Active projects", definition: "Projects with status Active or Awaiting release." },
  totalInspections: { label: "Total inspections", definition: "Inspections in the period (by inspection date, or planned date if not yet inspected), excluding cancelled records." },
  completedInspections: { label: "Inspections completed", definition: "Inspections in the period with a result recorded and submitted (Submitted, Reviewed or Accepted). Drafts and rejected records are not complete." },
  pendingInspections: { label: "Inspections pending", definition: "Total inspections in the period minus completed." },
  passRate: { label: "Inspection pass rate", definition: "Completed inspections with result Pass ÷ completed inspections with result Pass, Fail or Hold. N/A results are excluded from the denominator. Includes re-inspections." },
  firstPassYield: { label: "First-pass yield", definition: "First-attempt inspections (not re-inspections) that passed ÷ completed first-attempt inspections with result Pass, Fail or Hold. Measures getting it right first time, so re-inspections are excluded." },
  overdueInspections: { label: "Overdue inspections", definition: "Current: inspections not yet completed whose planned date has passed (not limited to the period)." },
  openNcrs: { label: "Open NCRs", definition: "Current: NCRs not Closed or Cancelled." },
  overdueNcrs: { label: "Overdue NCRs", definition: "Current: open NCRs past their target date." },
  openActions: { label: "Open corrective actions", definition: "Current: corrective/preventive actions not yet Verified or Cancelled." },
  overdueActions: { label: "Overdue actions", definition: "Current: actions Open or In progress past their due date." },
  weldDefects: { label: "Weld defects", definition: "Inspector-confirmed weld defects recorded in the period. Unconfirmed and AI-suggested defects are excluded." },
  reworkVolume: { label: "Rework volume", definition: "Repairs/rework records performed in the period (by performed date, else record date)." },
  reworkCost: { label: "Rework cost (actual)", definition: "Sum of cost entered as actual on rework records in the period. Estimates are reported separately; records without cost are not estimated." },
  materialExceptions: { label: "Material exceptions", definition: "Current: material records (excluding rejected) with a missing heat number, a certificate that is not verified, or an identification mismatch." },
  quarantined: { label: "Quarantined materials", definition: "Current: materials with status Quarantined." },
  outstandingNdt: { label: "Outstanding NDT reports", definition: "Current: NDT/test requests with no result recorded." },
  outstandingAudit: { label: "Audit actions outstanding", definition: "Current: audit findings not Closed." },
  releasedUnits: { label: "Released modules/frames", definition: "Current: modules/frames with an active (not revoked) release record ÷ all modules/frames." },
  missingEvidence: { label: "Missing evidence", definition: "Current: across active projects, the number of required photo-evidence categories (Settings → Release rules) with no photo." },
};

const COMPLETE: RecordStatus[] = ["SUBMITTED", "REVIEWED", "ACCEPTED"];
const DECIDED: InspectionResult[] = ["PASS", "FAIL", "HOLD"];

type InspRow = { result: InspectionResult; status: RecordStatus; reinspectionOfId: string | null };

/** Pure inspection KPI maths, exported for tests. */
export function inspectionKpis(rows: InspRow[]) {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const completed = live.filter((r) => COMPLETE.includes(r.status) && r.result !== "PENDING");
  const decided = completed.filter((r) => DECIDED.includes(r.result));
  const passed = decided.filter((r) => r.result === "PASS");
  const first = decided.filter((r) => !r.reinspectionOfId);
  const firstPassed = first.filter((r) => r.result === "PASS");
  return {
    total: live.length,
    completed: completed.length,
    pending: live.length - completed.length,
    passRate: decided.length ? passed.length / decided.length : null,
    passRateBasis: { numerator: passed.length, denominator: decided.length },
    firstPassYield: first.length ? firstPassed.length / first.length : null,
    fpyBasis: { numerator: firstPassed.length, denominator: first.length },
    outcomes: {
      PASS: completed.filter((r) => r.result === "PASS").length,
      FAIL: completed.filter((r) => r.result === "FAIL").length,
      HOLD: completed.filter((r) => r.result === "HOLD").length,
      NA: completed.filter((r) => r.result === "NA").length,
    },
  };
}

export type DataScope = "all" | "real" | "demo";

export interface KpiFilter {
  from: Date;
  to: Date;
  projectId?: string | null;
  data?: DataScope;
}

function demoWhere(scope: DataScope | undefined) {
  return scope === "real" ? { isDemo: false } : scope === "demo" ? { isDemo: true } : {};
}

/** ISO week start (Monday) as YYYY-MM-DD. */
function weekKey(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export async function computeKpis(f: KpiFilter) {
  const now = new Date();
  const demo = demoWhere(f.data);
  const proj = f.projectId ? { projectId: f.projectId } : {};
  const period = { gte: f.from, lte: f.to };
  const inspPeriod: Prisma.InspectionWhereInput = { OR: [{ inspectedAt: period }, { inspectedAt: null, plannedDate: period }, { inspectedAt: null, plannedDate: null, createdAt: period }] };

  const [rules, projects, inspections, overdueInspections, openNcrs, overdueNcrs, actions, defects, repairs, materials, ndtOutstanding, auditOpen, units, activeReleases, recentInspections, openNcrList, ncrAgeing] = await Promise.all([
    getSetting("releaseRules"),
    db.project.findMany({ where: { ...demo, ...(f.projectId ? { id: f.projectId } : {}), status: { not: "CANCELLED" } }, select: { id: true, code: true, name: true, status: true } }),
    db.inspection.findMany({
      where: { ...demo, ...proj, ...inspPeriod },
      select: { result: true, status: true, reinspectionOfId: true, inspectedAt: true, plannedDate: true, createdAt: true, stage: true, type: true, project: { select: { code: true } } },
    }),
    db.inspection.count({ where: { ...demo, ...proj, status: { in: ["DRAFT", "REJECTED"] }, plannedDate: { lt: now } } }),
    db.ncr.count({ where: { ...demo, ...proj, status: { in: OPEN_NCR } } }),
    db.ncr.count({ where: { ...demo, ...proj, status: { in: OPEN_NCR }, targetDate: { lt: now } } }),
    db.correctiveAction.findMany({ where: { ...demo, status: { notIn: ["VERIFIED", "CANCELLED"] }, ...(f.projectId ? { ncr: { projectId: f.projectId } } : {}) }, select: { status: true, dueDate: true } }),
    db.weldDefect.findMany({ where: { ...demo, confirmed: true, recordedAt: period, ...(f.projectId ? { weld: { projectId: f.projectId } } : {}) }, select: { category: true } }),
    db.repair.findMany({ where: { ...demo, ...proj, OR: [{ performedAt: period }, { performedAt: null, createdAt: period }] }, select: { cost: true, costIsEstimate: true, hours: true, performedAt: true, createdAt: true } }),
    db.material.findMany({ where: { ...demo, ...proj, status: { not: "REJECTED" } }, select: { heatNumber: true, certStatus: true, identificationMismatch: true, status: true } }),
    db.ndtRecord.count({ where: { ...demo, ...proj, result: "PENDING" } }),
    db.auditFinding.count({ where: { ...demo, status: { not: "CLOSED" } } }),
    db.unit.count({ where: { ...demo, ...proj } }),
    db.releaseRecord.findMany({ where: { ...demo, ...proj, revokedAt: null }, select: { unitId: true, projectId: true, status: true } }),
    db.inspection.findMany({
      where: { ...demo, ...proj, status: { not: "CANCELLED" } },
      orderBy: [{ inspectedAt: { sort: "desc", nulls: "last" } }],
      take: 6,
      select: { id: true, code: true, inspectedAt: true, type: true, result: true, inspectorName: true, unit: { select: { ref: true } }, project: { select: { code: true } } },
    }),
    db.ncr.findMany({
      where: { ...demo, ...proj, status: { in: OPEN_NCR } },
      orderBy: [{ priority: "desc" }, { raisedAt: "asc" }],
      take: 6,
      select: { id: true, code: true, priority: true, raisedAt: true, targetDate: true, status: true, unit: { select: { ref: true } }, project: { select: { code: true } } },
    }),
    db.ncr.findMany({ where: { ...demo, ...proj, status: { in: OPEN_NCR } }, select: { raisedAt: true } }),
  ]);

  const insp = inspectionKpis(inspections);
  const decidedRows = inspections.filter((r) => r.status !== "CANCELLED" && COMPLETE.includes(r.status) && DECIDED.includes(r.result));
  const trendMap = new Map<string, { pass: number; decided: number; firstPass: number; first: number; fails: number }>();
  for (const r of decidedRows) {
    const k = weekKey(r.inspectedAt ?? r.plannedDate ?? r.createdAt);
    const t = trendMap.get(k) ?? { pass: 0, decided: 0, firstPass: 0, first: 0, fails: 0 };
    t.decided++;
    if (r.result === "PASS") t.pass++;
    else t.fails++;
    if (!r.reinspectionOfId) {
      t.first++;
      if (r.result === "PASS") t.firstPass++;
    }
    trendMap.set(k, t);
  }
  const reworkByWeek = countBy(repairs, (r) => weekKey(r.performedAt ?? r.createdAt));
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, t]) => ({
      week,
      passRate: t.decided ? Math.round((t.pass / t.decided) * 1000) / 10 : null,
      fpy: t.first ? Math.round((t.firstPass / t.first) * 1000) / 10 : null,
      inspections: t.decided,
      rework: reworkByWeek.find((x) => x.key === week)?.count ?? 0,
    }));

  const byProject = countBy(decidedRows.filter((r) => r.result !== "PASS"), (r) => r.project.code);
  const failsByStage = countBy(decidedRows.filter((r) => r.result !== "PASS"), (r) => r.stage ?? r.type.replace(/_/g, " ").toLowerCase());

  const actualCost = repairs.filter((r) => r.cost != null && !r.costIsEstimate).reduce((s, r) => s + Number(r.cost), 0);
  const estCost = repairs.filter((r) => r.cost != null && r.costIsEstimate).reduce((s, r) => s + Number(r.cost), 0);
  const costed = repairs.filter((r) => r.cost != null && !r.costIsEstimate).length;

  const materialExceptions = materials.filter((m) => !m.heatNumber || m.certStatus !== "VERIFIED" || m.identificationMismatch).length;

  const activeProjects = projects.filter((p) => p.status === "ACTIVE" || p.status === "AWAITING_RELEASE");
  let missingEvidence = 0;
  const missingByProject: { code: string; id: string; missing: string[] }[] = [];
  if (rules.requiredPhotoCategories.length && activeProjects.length) {
    const have = await db.photo.groupBy({ by: ["projectId", "category"], where: { projectId: { in: activeProjects.map((p) => p.id) }, deletedAt: null, reviewStatus: { not: "REJECTED" } } });
    for (const p of activeProjects) {
      const cats = new Set(have.filter((h) => h.projectId === p.id).map((h) => h.category));
      const missing = rules.requiredPhotoCategories.filter((c) => !cats.has(c));
      missingEvidence += missing.length;
      if (missing.length) missingByProject.push({ code: p.code, id: p.id, missing });
    }
  }

  const ageBuckets = [
    { label: "0–7 days", max: 7 },
    { label: "8–14 days", max: 14 },
    { label: "15–30 days", max: 30 },
    { label: "31–60 days", max: 60 },
    { label: ">60 days", max: Infinity },
  ].map((b) => ({ ...b, count: 0 }));
  for (const n of ncrAgeing) {
    const days = (now.getTime() - n.raisedAt.getTime()) / 86_400_000;
    const b = ageBuckets.find((x) => days <= x.max)!;
    b.count++;
  }

  return {
    generatedAt: now,
    filter: f,
    projects: { total: projects.length, active: activeProjects.length, awaitingRelease: projects.filter((p) => p.status === "AWAITING_RELEASE").length, released: projects.filter((p) => p.status === "RELEASED").length },
    inspections: { ...insp, overdue: overdueInspections },
    ncrs: { open: openNcrs, overdue: overdueNcrs },
    actions: { open: actions.length, overdue: actions.filter((a) => a.dueDate && a.dueDate < now && (a.status === "OPEN" || a.status === "IN_PROGRESS")).length },
    weldDefects: { total: defects.length, byCategory: countBy(defects, (d) => d.category) },
    rework: { volume: repairs.length, actualCost: costed ? actualCost : null, costedRecords: costed, estimatedCost: estCost || null, hours: repairs.reduce((s, r) => s + (r.hours ? Number(r.hours) : 0), 0) || null },
    materials: { exceptions: materialExceptions, quarantined: materials.filter((m) => m.status === "QUARANTINED").length, total: materials.length },
    ndt: { outstanding: ndtOutstanding },
    audit: { outstanding: auditOpen },
    release: { units, releasedUnits: new Set(activeReleases.filter((r) => r.unitId).map((r) => r.unitId)).size, releasedProjects: activeReleases.filter((r) => !r.unitId).length },
    evidence: { missing: missingEvidence, byProject: missingByProject },
    trend,
    failsByProject: byProject,
    failsByStage,
    ncrAgeing: ageBuckets.map(({ label, count }) => ({ label, count })),
    recentInspections,
    openNcrList,
  };
}

export type Kpis = Awaited<ReturnType<typeof computeKpis>>;

export async function demoRecordCount() {
  const [p, i, ph] = await Promise.all([db.project.count({ where: { isDemo: true } }), db.inspection.count({ where: { isDemo: true } }), db.photo.count({ where: { isDemo: true } })]);
  return p + i + ph;
}
