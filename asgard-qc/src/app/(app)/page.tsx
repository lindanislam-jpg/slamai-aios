import { Camera, ClipboardPlus, FileDown, Search, TriangleAlert, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Bars, Donut, TrendChart } from "@/components/charts";
import { FilterSelect } from "@/components/fields";
import { Badge, Card, Empty, fmtDate, fmtDateTime, pct, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeKpis, KPI_DEFINITIONS, type DataScope } from "@/lib/kpi";
import { projectOptions } from "@/lib/options";
import { enumParam, PERIODS, periodRange, str, type SP } from "@/lib/params";
import { materialFlags } from "@/lib/services/materials";
import { qmsStatus } from "@/lib/integrations/qms";

export const metadata = { title: "Executive Quality Overview" };

function delta(cur: number | null, prev: number | null, kind: "pct" | "count", goodUp: boolean) {
  if (cur == null || prev == null) return <span>no prior data</span>;
  const d = kind === "pct" ? (cur - prev) * 100 : cur - prev;
  if (Math.abs(d) < 0.05) return <span>no change vs previous period</span>;
  const good = goodUp ? d > 0 : d < 0;
  return (
    <span className={good ? "text-ok-400" : "text-bad-400"}>
      {d > 0 ? "↑" : "↓"} {kind === "pct" ? `${Math.abs(d).toFixed(1)} pts` : Math.abs(d)} <span className="text-ink-300">vs previous period</span>
    </span>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("records.view");
  const sp = await searchParams;
  const range = periodRange(sp);
  const projectId = str(sp, "projectId");
  const data = enumParam<DataScope>(sp, "data", ["all", "real", "demo"]) ?? "all";
  const span = range.to.getTime() - range.from.getTime();
  const [k, prev, projects, materials] = await Promise.all([
    computeKpis({ from: range.from, to: range.to, projectId, data }),
    computeKpis({ from: new Date(range.from.getTime() - span), to: range.from, projectId, data }),
    projectOptions(),
    db.material.findMany({ where: projectId ? { projectId } : {}, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);
  const qms = qmsStatus();
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const d = (key: string) => KPI_DEFINITIONS[key].definition;

  const risks: { label: string; area: string; level: "HIGH" | "MEDIUM" | "LOW"; href: string }[] = [];
  const topDefect = k.weldDefects.byCategory[0];
  if (topDefect && topDefect.count >= 2) risks.push({ label: `Recurring weld defects (${topDefect.key.toLowerCase()}, ${topDefect.count})`, area: "Welding", level: topDefect.count >= 3 ? "HIGH" : "MEDIUM", href: "/welding?tab=analytics" });
  if (k.ncrs.overdue) risks.push({ label: `${k.ncrs.overdue} NCR(s) past target date`, area: "All", level: "HIGH", href: "/ncr?overdue=1" });
  if (k.materials.exceptions) risks.push({ label: `${k.materials.exceptions} material traceability exception(s)`, area: "Materials", level: k.materials.quarantined ? "HIGH" : "MEDIUM", href: "/materials?gaps=1" });
  const aged = k.ncrAgeing.slice(3).reduce((s, b) => s + b.count, 0);
  if (aged) risks.push({ label: `NCR ageing > 30 days (${aged})`, area: "All", level: "MEDIUM", href: "/ncr?status=OPEN_ALL" });
  if (k.actions.overdue) risks.push({ label: `${k.actions.overdue} overdue corrective action(s)`, area: "CAPA", level: "MEDIUM", href: "/ncr?status=OPEN_ALL" });
  if (k.inspections.overdue) risks.push({ label: `Inspection backlog (${k.inspections.overdue} overdue)`, area: "Production", level: "MEDIUM", href: "/inspections?overdue=1" });
  if (k.ndt.outstanding) risks.push({ label: `${k.ndt.outstanding} NDT report(s) outstanding`, area: "Welding", level: "LOW", href: "/ndt?outstanding=1" });
  if (k.evidence.missing) risks.push({ label: `${k.evidence.missing} required evidence item(s) missing`, area: "Evidence", level: "LOW", href: "/photos" });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-[28px]">Quality Department Dashboard</h1>
          <p className="mt-1 text-sm text-ink-300">Calculated live from application records · {range.label} · generated {fmtDateTime(k.generatedAt)}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <FilterSelect name="projectId" label="Project" options={projects} value={projectId} empty="All projects" />
          <FilterSelect name="period" label="Period" options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={str(sp, "period") ?? "30"} empty="Last 30 days" />
          <FilterSelect name="data" label="Data" options={[{ value: "real", label: "Real records only" }, { value: "demo", label: "Demo records only" }]} value={data === "all" ? null : data} empty="All records" />
          <button className="btn-secondary">Apply</button>
          <a href={`/api/export/kpis?${q}`} className="btn-ghost" title="Download KPI workbook with formulas"><FileDown className="h-4 w-4" />Excel</a>
        </form>
      </div>

      {!qms.connected && (
        <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
          Source: ASGARD Quality Command Centre database. External QMS: {qms.label}. Records marked DEMO are synthetic and must not be reported as company results.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total inspections" value={k.inspections.total} sub={delta(k.inspections.total, prev.inspections.total, "count", true)} href="/inspections" title={d("totalInspections")} />
        <Stat label="Inspections completed" value={k.inspections.completed} sub={`${k.inspections.pending} pending`} href="/inspections" title={d("completedInspections")} />
        <Stat label="Inspection pass rate" value={pct(k.inspections.passRate)} tone="ok" sub={delta(k.inspections.passRate, prev.inspections.passRate, "pct", true)} title={`${d("passRate")} Basis: ${k.inspections.passRateBasis.numerator}/${k.inspections.passRateBasis.denominator}.`} />
        <Stat label="First-pass yield" value={pct(k.inspections.firstPassYield)} tone="ok" sub={delta(k.inspections.firstPassYield, prev.inspections.firstPassYield, "pct", true)} title={`${d("firstPassYield")} Basis: ${k.inspections.fpyBasis.numerator}/${k.inspections.fpyBasis.denominator}.`} />
        <Stat label="Open NCRs" value={k.ncrs.open} tone={k.ncrs.open ? "warn" : undefined} sub="current" href="/ncr?status=OPEN_ALL" title={d("openNcrs")} />
        <Stat label="Overdue NCRs" value={k.ncrs.overdue} tone={k.ncrs.overdue ? "bad" : undefined} sub="current" href="/ncr?overdue=1" title={d("overdueNcrs")} />
        <Stat label="Open corrective actions" value={k.actions.open} sub={`${k.actions.overdue} overdue`} href="/ncr?status=OPEN_ALL" title={d("openActions")} />
        <Stat label="Rework volume" value={k.rework.volume} sub={k.rework.actualCost != null ? `Actual cost ${k.rework.actualCost.toLocaleString("en-GB")} (${k.rework.costedRecords} costed)` : "No actual cost recorded"} href="/rework" title={`${d("reworkVolume")} ${d("reworkCost")}`} />
        <Stat label="Weld defects" value={k.weldDefects.total} sub="confirmed, in period" href="/welding?tab=analytics" title={d("weldDefects")} />
        <Stat label="Material exceptions" value={k.materials.exceptions} tone={k.materials.exceptions ? "warn" : undefined} sub={`${k.materials.quarantined} quarantined`} href="/materials?gaps=1" title={d("materialExceptions")} />
        <Stat label="Overdue inspections" value={k.inspections.overdue} tone={k.inspections.overdue ? "warn" : undefined} sub={`${k.ndt.outstanding} NDT reports outstanding`} href="/inspections?overdue=1" title={d("overdueInspections")} />
        <Stat label="Audit actions outstanding" value={k.audit.outstanding} sub={`${k.evidence.missing} evidence gaps`} href="/audits" title={d("outstandingAudit")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card title="Quality performance trend (weekly)">
          <TrendChart data={k.trend} />
        </Card>
        <Card title="Weld defects by type" actions={<Link href="/welding?tab=analytics" className="link text-xs">Details</Link>}>
          <Donut data={k.weldDefects.byCategory.map((c) => ({ name: c.key, value: c.count }))} total={k.weldDefects.total} label="Confirmed defects" />
        </Card>
        <Card title="Inspection outcomes">
          <Donut
            data={[
              { name: "Passed", value: k.inspections.outcomes.PASS },
              { name: "Failed", value: k.inspections.outcomes.FAIL },
              { name: "Hold", value: k.inspections.outcomes.HOLD },
              { name: "N/A", value: k.inspections.outcomes.NA },
            ]}
            colors={["#1fb894", "#e5484d", "#f0a531", "#7d8fa3"]}
            total={k.inspections.completed}
            label="Completed"
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Recent inspections" actions={<Link href="/inspections" className="btn-secondary btn-sm">View all</Link>} pad={false}>
          {k.recentInspections.length ? (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Frame</th><th>Type</th><th>Result</th><th>Inspector</th></tr></thead>
                <tbody>
                  {k.recentInspections.map((i) => (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap"><Link className="link" href={`/inspections/${i.id}`}>{fmtDate(i.inspectedAt)}</Link></td>
                      <td>{i.unit?.ref ?? i.project.code}</td>
                      <td>{i.type.replace(/_/g, " ").toLowerCase()}</td>
                      <td><Badge value={i.result} /></td>
                      <td>{i.inspectorName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-4"><Empty title="No inspections recorded yet" /></div>}
        </Card>
        <Card title="Open NCRs" actions={<Link href="/ncr?status=OPEN_ALL" className="btn-secondary btn-sm">View all</Link>} pad={false}>
          {k.openNcrList.length ? (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>NCR</th><th>Frame</th><th>Priority</th><th>Days open</th></tr></thead>
                <tbody>
                  {k.openNcrList.map((n) => {
                    const days = Math.floor((Date.now() - n.raisedAt.getTime()) / 86_400_000);
                    const overdue = n.targetDate && n.targetDate < new Date();
                    return (
                      <tr key={n.id}>
                        <td><Link className="link" href={`/ncr/${n.id}`}>{n.code}</Link></td>
                        <td>{n.unit?.ref ?? n.project.code}</td>
                        <td><Badge value={n.priority} /></td>
                        <td className={overdue ? "text-bad-400" : ""}>{days}{overdue ? " · overdue" : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="p-4"><Empty title="No open NCRs" /></div>}
        </Card>
        <Card title="Material traceability" actions={<Link href="/materials" className="btn-secondary btn-sm">View all</Link>} pad={false}>
          {materials.length ? (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Material</th><th>Grade</th><th>Heat no.</th><th>Status</th></tr></thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td><Link className="link" href={`/materials/${m.id}`}>{m.code}</Link></td>
                      <td>{m.grade ?? <span className="text-warn-400">—</span>}</td>
                      <td>{m.heatNumber ?? <span className="text-bad-400">missing</span>}</td>
                      <td><Badge value={m.status} />{materialFlags(m).length > 1 && <span className="ml-1 text-[11px] text-warn-400">+{materialFlags(m).length - 1} flag</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-4"><Empty title="No materials registered" /></div>}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="NCR ageing (open NCRs)">
          <Bars data={k.ncrAgeing.map((b) => ({ key: b.label, count: b.count }))} colors={["#1fb894", "#1fb894", "#f0a531", "#f97316", "#e5484d"]} />
        </Card>
        <Card title="Top quality risks" pad={false}>
          {risks.length ? (
            <table className="tbl">
              <thead><tr><th>Risk</th><th>Area</th><th>Priority</th></tr></thead>
              <tbody>
                {risks.slice(0, 6).map((r) => (
                  <tr key={r.label}>
                    <td><Link href={r.href} className="hover:underline">{r.label}</Link></td>
                    <td className="text-ink-300">{r.area}</td>
                    <td><Badge value={r.level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-4"><Empty title="No risks flagged from current records" /></div>}
          <p className="px-4 py-2 text-[11px] text-ink-400">Derived from records by fixed rules (recurrence, overdue, gaps). Not a risk assessment.</p>
        </Card>
        <Card title="Quick actions" pad={false}>
          <ul className="divide-y divide-ink-600/70">
            {[
              { href: "/ncr/new", icon: TriangleAlert, t: "Create NCR", s: "Log a new non-conformance report" },
              { href: "/inspections/new", icon: ClipboardPlus, t: "Record inspection", s: "Add inspection result and evidence" },
              { href: "/photos?upload=1", icon: Camera, t: "Upload factory photos", s: "Add photographic evidence to a project" },
              { href: "/materials", icon: Search, t: "Trace material", s: "Search by heat number or certificate" },
              { href: "/analytics", icon: FileDown, t: "Generate report", s: "PDF quality report or Excel export" },
            ].map(({ href, icon: Icon, t, s }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-700/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok-600/15 text-ok-400"><Icon className="h-4 w-4" /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-ink-100">{t}</span>
                    <span className="block text-xs text-ink-300">{s}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Projects (active / total)" value={`${k.projects.active} / ${k.projects.total}`} sub={`${k.projects.awaitingRelease} awaiting release · ${k.projects.released} released`} href="/projects" />
        <Stat label="Modules/frames released" value={`${k.release.releasedUnits} / ${k.release.units}`} href="/release" title={d("releasedUnits")} />
        <Stat label="Outstanding NDT reports" value={k.ndt.outstanding} href="/ndt?outstanding=1" title={d("outstandingNdt")} />
        <Stat label="Missing project evidence" value={k.evidence.missing} sub={k.evidence.byProject.slice(0, 2).map((p) => `${p.code}: ${p.missing.length}`).join(" · ") || "All required categories present"} title={d("missingEvidence")} />
      </div>
      <p className="text-[11px] text-ink-400">Hover a tile for its definition. Full KPI definitions: <Link className="link" href="/analytics?tab=definitions">Analytics → KPI definitions</Link>.</p>
    </div>
  );
}
