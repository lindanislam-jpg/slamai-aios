import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { ReportGenerator } from "@/components/analytics/ReportGenerator";
import { Bars, TrendChart } from "@/components/charts";
import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, Card, Empty, fmtDateTime, PageHeader, pct, Stat, Tabs } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXPORTS } from "@/lib/export/xlsx";
import { computeKpis, KPI_DEFINITIONS } from "@/lib/kpi";
import { projectOptions } from "@/lib/options";
import { PERIODS, periodRange, str, type SP } from "@/lib/params";
import { REPORT_TYPES } from "@/lib/report/data";

export const metadata = { title: "Analytics & Reports" };

const EXPORT_NOTES: Record<keyof typeof EXPORTS, string> = {
  kpis: "KPI values with Excel formulas over the raw inspection rows, definitions and a data dictionary.",
  projects: "All projects with counts of frames, inspections, photos and open NCRs.",
  inspections: "Every inspection with result, record status, reviewer and first-attempt flag.",
  "weld-defects": "Weld defects (confirmed and unconfirmed, with source) plus the weld register.",
  materials: "Material traceability register with heat numbers, certificate status and flags.",
  ncrs: "NCR register with root cause, ageing and overdue flags, plus CAPA actions.",
  rework: "Repairs and rework; cost marked ACTUAL or ESTIMATE, never inferred.",
  audits: "Audits and findings with open actions.",
  photos: "Photo evidence index with links, capture/upload times and SHA-256 fingerprints.",
  release: "Release gate checklist for each active project and frame, plus ITP control points.",
  templates: "Quality Manager review pack: every checklist template and check, release rules and role permissions, with decision columns.",
};

export default async function Analytics({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const tab = str(sp, "tab") ?? "reports";
  const projectId = str(sp, "projectId");
  const projects = await projectOptions();
  const canReport = actor.permissions.has("report.generate");
  const canExport = actor.permissions.has("export.excel");

  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="PDF quality reports, Excel exports, trends and KPI definitions — all compiled from current records." />
      <Tabs
        base="/analytics"
        active={tab}
        tabs={[
          { key: "reports", label: "PDF reports" },
          { key: "exports", label: "Excel exports" },
          { key: "trends", label: "Trends" },
          { key: "definitions", label: "KPI definitions" },
        ]}
      />
      {tab === "reports" && <Reports canReport={canReport} projects={projects} />}
      {tab === "exports" && <Exports canExport={canExport} projects={projects} sp={sp} />}
      {tab === "trends" && <Trends sp={sp} projectId={projectId} projects={projects} />}
      {tab === "definitions" && <Definitions />}
    </div>
  );
}

async function Reports({ canReport, projects }: { canReport: boolean; projects: { value: string; label: string }[] }) {
  const [units, jobs] = await Promise.all([
    db.unit.findMany({ orderBy: { ref: "asc" }, select: { id: true, ref: true, type: true, projectId: true } }),
    db.reportJob.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { project: { select: { code: true } } } }),
  ]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <Card title="Generate a project quality report">
        {canReport ? (
          <ReportGenerator
            types={Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))}
            projects={projects}
            units={units.map((u) => ({ value: u.id, label: `${u.ref} (${u.type.toLowerCase()})`, projectId: u.projectId }))}
          />
        ) : (
          <p className="text-sm text-ink-300">Your role cannot generate reports.</p>
        )}
      </Card>
      <Card title="Recent reports" pad={false}>
        {jobs.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Type</th><th>Project</th><th>Rev</th><th>Status</th><th>Generated</th><th></th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="whitespace-nowrap">{j.code}</td>
                    <td>{REPORT_TYPES[j.reportType as keyof typeof REPORT_TYPES] ?? j.reportType}</td>
                    <td>{j.project.code}</td>
                    <td>{j.revision}</td>
                    <td><Badge value={j.status} tone={j.status === "COMPLETED" ? "ok" : j.status === "FAILED" ? "bad" : "warn"} /></td>
                    <td className="whitespace-nowrap text-ink-300">{fmtDateTime(j.createdAt)} · {j.createdByName ?? "—"}</td>
                    <td>{j.status === "COMPLETED" ? <a className="link" href={`/api/reports/${j.id}`}>Download</a> : j.error ? <span className="text-xs text-bad-400" title={j.error}>error</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4"><Empty title="No reports generated yet" /></div>
        )}
      </Card>
    </div>
  );
}

function Exports({ canExport, projects, sp }: { canExport: boolean; projects: { value: string; label: string }[]; sp: SP }) {
  if (!canExport) return <Empty title="Your role cannot export to Excel." />;
  const q = new URLSearchParams();
  for (const k of ["projectId", "from", "to"]) {
    const v = str(sp, k);
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return (
    <>
      <FilterBar reset="/analytics?tab=exports">
        <input type="hidden" name="tab" value="exports" />
        <FilterSelect name="projectId" label="Project" options={projects} value={str(sp, "projectId")} empty="All projects" />
        <FilterInput name="from" label="From" type="date" value={str(sp, "from")} />
        <FilterInput name="to" label="To" type="date" value={str(sp, "to")} />
      </FilterBar>
      <p className="mb-3 text-xs text-ink-300">Filters apply where relevant (dates filter inspections, defects, NCRs and the KPI period). Exports are read-only extracts; DEMO rows are labelled in a Source column.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(EXPORTS) as (keyof typeof EXPORTS)[]).map((k) => (
          <div key={k} className="card card-pad flex flex-col">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-100"><FileSpreadsheet className="h-4 w-4 text-ok-400" />{EXPORTS[k]}</div>
            <p className="mt-1 flex-1 text-xs text-ink-300">{EXPORT_NOTES[k]}</p>
            <a className="btn-secondary btn-sm mt-3 self-start" href={`/api/export/${k}${qs ? `?${qs}` : ""}`}>Download .xlsx</a>
          </div>
        ))}
      </div>
    </>
  );
}

async function Trends({ sp, projectId, projects }: { sp: SP; projectId: string | null; projects: { value: string; label: string }[] }) {
  const range = periodRange(sp);
  const k = await computeKpis({ from: range.from, to: range.to, projectId });
  return (
    <div className="space-y-4">
      <FilterBar reset="/analytics?tab=trends">
        <input type="hidden" name="tab" value="trends" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} empty="All projects" />
        <FilterSelect name="period" label="Period" options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={str(sp, "period")} empty="Last 30 days" />
      </FilterBar>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pass rate" value={pct(k.inspections.passRate)} tone="ok" sub={`${k.inspections.passRateBasis.numerator}/${k.inspections.passRateBasis.denominator} decided`} />
        <Stat label="First-pass yield" value={pct(k.inspections.firstPassYield)} tone="ok" sub={`${k.inspections.fpyBasis.numerator}/${k.inspections.fpyBasis.denominator} first attempts`} />
        <Stat label="Confirmed weld defects" value={k.weldDefects.total} />
        <Stat label="Rework records" value={k.rework.volume} sub={k.rework.actualCost != null ? `Actual cost ${k.rework.actualCost}` : "No actual cost recorded"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Weekly trend · ${range.label}`}><TrendChart data={k.trend} /></Card>
        <Card title="NCR ageing (open)"><Bars data={k.ncrAgeing.map((b) => ({ key: b.label, count: b.count }))} colors={["#1fb894", "#1fb894", "#f0a531", "#f97316", "#e5484d"]} /></Card>
        <Card title="Failed / held inspections by project"><Bars data={k.failsByProject} color="#e5484d" /></Card>
        <Card title="Failed / held inspections by stage"><Bars data={k.failsByStage} color="#f0a531" /></Card>
      </div>
      <p className="text-xs text-ink-300">Weld defect Pareto and repeat-defect analysis: <Link className="link" href="/welding?tab=analytics">Welding QC → Analytics</Link>.</p>
    </div>
  );
}

function Definitions() {
  return (
    <div className="space-y-4">
      <Card title="KPI definitions" pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>KPI</th><th>Definition</th></tr></thead>
            <tbody>
              {Object.entries(KPI_DEFINITIONS).map(([key, d]) => (
                <tr key={key}><td className="whitespace-nowrap font-medium">{d.label}</td><td className="text-ink-200">{d.definition}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pass rate vs first-pass yield">
          <div className="space-y-2 text-sm text-ink-200">
            <p><strong>Pass rate</strong> counts every completed inspection, including re-inspections after repair. A frame that fails and then passes on re-inspection adds one fail and one pass.</p>
            <p><strong>First-pass yield</strong> counts only first attempts. The same frame counts as one fail, so FPY shows how often work is right first time and is normally lower than the pass rate.</p>
            <p>Both exclude N/A results, drafts, rejected records and cancelled inspections. When the denominator is zero the KPI shows “—”, not 0% or 100%.</p>
          </div>
        </Card>
        <Card title="Demo data policy">
          <div className="space-y-2 text-sm text-ink-200">
            <p>Synthetic records created by the seed script are flagged <Badge tone="gold" label="DEMO" /> and labelled in the header, in exports (Source = DEMO) and in PDF reports (watermark).</p>
            <p>Use the dashboard’s Data filter to view real records only. Demo data must never be reported as ASGARD results. An administrator can remove all demo records from Settings → Data.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
