import { Bot, Camera, CheckCircle2, ChevronRight, ClipboardPlus, FileDown, Search, TriangleAlert } from "lucide-react";
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
import { listPacks, packCounts } from "@/lib/services/quality-packs";
import { attentionQueue, projectHealth, type AttentionLevel, type Rag } from "@/lib/attention";
import { aiStatus } from "@/lib/ai/vision";
import { AUTOMATION_ACTIONS, automationActivity } from "@/lib/automation";
import { qmsStatus } from "@/lib/integrations/qms";
import { alertCounts } from "@/lib/services/alerts";
import { cmrCounts } from "@/lib/services/cmrs";
import { SystemHealthPanel } from "@/components/system/SystemHealthPanel";
import { monitorStatus } from "@/lib/monitor/run";

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

const LEVEL_BAR: Record<AttentionLevel, string> = { CRITICAL: "bg-bad-500", HIGH: "bg-bad-400", MEDIUM: "bg-warn-400", LOW: "bg-ink-400", INFO: "bg-ink-500" };
const RAG_TONE: Record<Rag, "bad" | "warn" | "ok"> = { RED: "bad", AMBER: "warn", GREEN: "ok" };

type KpiRow = [label: string, value: number | string, title?: string, tone?: "warn" | "bad"];

function KpiGroup({ title, href, rows }: { title: string; href: string; rows: KpiRow[] }) {
  return (
    <Card title={title} actions={<Link href={href} className="link text-xs">Open</Link>}>
      <dl className="space-y-2">
        {rows.map(([label, value, tip, tone]) => (
          <div key={label} title={tip} className="flex items-baseline justify-between gap-3 border-b border-ink-600/50 pb-1.5 last:border-0 last:pb-0">
            <dt className="text-sm text-ink-300">{label}</dt>
            <dd className={`text-base font-semibold tabular-nums ${tone === "bad" ? "text-bad-400" : tone === "warn" ? "text-warn-400" : "text-ink-100"}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const range = periodRange(sp);
  const projectId = str(sp, "projectId");
  const data = enumParam<DataScope>(sp, "data", ["all", "real", "demo"]) ?? "all";
  const span = range.to.getTime() - range.from.getTime();
  const [k, prev, projects, materials, health, demoProjects, cmr, alerts, monitor, attention, automation, packsBack, packsRecent] = await Promise.all([
    computeKpis({ from: range.from, to: range.to, projectId, data }),
    computeKpis({ from: new Date(range.from.getTime() - span), to: range.from, projectId, data }),
    projectOptions(),
    db.material.findMany({ where: projectId ? { projectId } : {}, orderBy: { updatedAt: "desc" }, take: 5 }),
    projectHealth(data),
    db.project.count({ where: { isDemo: true } }),
    cmrCounts(),
    alertCounts(),
    monitorStatus(),
    attentionQueue(actor, projectId),
    automationActivity(7),
    packCounts({ projectId, stage: "RETURNED" }),
    listPacks({ projectId, stage: "RETURNED" }, 8),
  ]);
  const packsReturned = packsBack.reduce((n, c) => n + c.returned, 0);
  // Only mention demo data while some exists (it is removed once a company goes live).
  const hasDemo = demoProjects > 0;
  const aiReady = aiStatus().configured;
  // An empty period is usually "nothing recorded lately", not "no records": say where the records are.
  const older = k.inspections.total === 0 && str(sp, "period") !== "365"
    ? await db.inspection.count({ where: { status: { not: "CANCELLED" }, inspectedAt: { gte: new Date(Date.now() - 365 * 86_400_000) }, ...(projectId ? { projectId } : {}) } })
    : 0;
  const rag = { RED: health.filter((p) => p.rag === "RED").length, AMBER: health.filter((p) => p.rag === "AMBER").length, GREEN: health.filter((p) => p.rag === "GREEN").length };
  const urgentAlerts = alerts.bySeverity.CRITICAL + alerts.bySeverity.HIGH;
  const qms = qmsStatus();
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const d = (key: string) => KPI_DEFINITIONS[key].definition;

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
          {hasDemo && <FilterSelect name="data" label="Data" options={[{ value: "real", label: "Real records only" }, { value: "demo", label: "Demo records only" }]} value={data === "all" ? null : data} empty="All records" />}
          <button className="btn-secondary">Apply</button>
          <a href={`/api/export/kpis?${q}`} className="btn-ghost" title="Download KPI workbook with formulas"><FileDown className="h-4 w-4" />Excel</a>
        </form>
      </div>

      {!qms.connected && (
        <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
          Source: ASGARD Quality Command Centre database. External QMS: {qms.label}.{hasDemo && " Records marked DEMO are synthetic and must not be reported as company results."}
        </div>
      )}

      {older > 0 && (
        <div className="rounded-lg border border-info-500/40 bg-info-500/10 px-4 py-2 text-sm text-ink-100">
          No inspections were recorded in this period ({range.label.toLowerCase()}). There are {older} in the last 12 months.{" "}
          <Link className="link" href={`/?period=365${projectId ? `&projectId=${projectId}` : ""}`}>Show the last 12 months</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Needs attention" value={attention.total} tone={attention.urgent ? "bad" : attention.total ? "warn" : "ok"} sub={attention.total ? `${attention.urgent} urgent · ${attention.forYou} for you` : "Nothing waiting"} href="#attention" title="Open alerts of Medium severity or above, plus records waiting for a review, a verification or a planned inspection." />
        <Stat label="Inspection pass rate" value={pct(k.inspections.passRate)} tone="ok" sub={delta(k.inspections.passRate, prev.inspections.passRate, "pct", true)} title={`${d("passRate")} Basis: ${k.inspections.passRateBasis.numerator}/${k.inspections.passRateBasis.denominator}.`} />
        <Stat label="First-pass yield" value={pct(k.inspections.firstPassYield)} tone="ok" sub={delta(k.inspections.firstPassYield, prev.inspections.firstPassYield, "pct", true)} title={`${d("firstPassYield")} Basis: ${k.inspections.fpyBasis.numerator}/${k.inspections.fpyBasis.denominator}.`} />
        <Stat label="Open NCRs" value={k.ncrs.open} tone={k.ncrs.overdue ? "bad" : k.ncrs.open ? "warn" : undefined} sub={`${k.ncrs.overdue} overdue`} href="/ncr?status=OPEN_ALL" title={d("openNcrs")} />
        <Stat label="Projects at risk" value={`${rag.RED} / ${health.length}`} tone={rag.RED ? "bad" : rag.AMBER ? "warn" : "ok"} sub={`${rag.AMBER} amber · ${rag.GREEN} green`} href="#projects" title="Active projects marked red by the fixed rules shown in the project health table." />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.7fr_1fr] [&>*]:min-w-0">
        <Card title={<span id="attention">Needs attention now ({attention.total})</span>} actions={<Link href="/alerts" className="btn-secondary btn-sm">All alerts</Link>} pad={false}>
          {attention.items.length ? (
            <ul className="divide-y divide-ink-600/70">
              {attention.items.slice(0, 10).map((i) => (
                <li key={i.key}>
                  <Link href={i.href} className="flex items-center gap-2 px-4 py-2.5 hover:bg-ink-700/50 sm:gap-3">
                    <span className={`h-9 w-1 shrink-0 rounded-full ${LEVEL_BAR[i.level]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-100">{i.title}</span>
                      <span className="block truncate text-xs text-ink-300">{i.detail} · {i.owner}</span>
                    </span>
                    {i.forYou && <Badge tone="gold" label="For you" />}
                    <Badge value={i.level} />
                    <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-ink-300 sm:block" title="Days waiting">{i.ageDays} d</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 p-5 text-sm text-ink-200"><CheckCircle2 className="h-5 w-5 text-ok-400" />Nothing is waiting: no open alerts of Medium severity or above, and no record awaiting review or verification.</div>
          )}
          {attention.items.length > 10 && <p className="px-4 py-2 text-xs text-ink-300">Showing the 10 most urgent of {attention.total}. <Link className="link" href="/alerts">See all alerts</Link> · <Link className="link" href="/inspections?status=SUBMITTED">inspections awaiting review</Link></p>}
        </Card>

        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-gold-300" />Automation · last {automation.days} days</span>} actions={actor.permissions.has("system.view") ? <Link href="/system#automation" className="link text-xs">Settings</Link> : undefined}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {Object.entries(AUTOMATION_ACTIONS).map(([key, label]) => (
                <div key={key} className="flex items-baseline justify-between gap-2 border-b border-ink-600/50 pb-1.5">
                  <dt className="text-xs text-ink-300">{label}</dt>
                  <dd className="font-semibold tabular-nums text-ink-100">{automation.counts[key]}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 space-y-1 text-xs text-ink-300">
              <li>{automation.cfg.autoNcrOnFailedInspection ? "On" : "Off"} · a failed inspection raises its NCR</li>
              <li>{automation.cfg.autoPlanReinspection ? "On" : "Off"} · re-inspection planned when an NCR is ready to verify</li>
              <li>{automation.cfg.escalateUnacknowledgedDays ? `On · urgent alerts escalate after ${automation.cfg.escalateUnacknowledgedDays} days unacknowledged` : "Off · alert escalation"}</li>
              <li>{automation.cfg.weeklyDigest ? "On" : "Off"} · weekly summary every Monday 09:00</li>
              <li>{automation.cfg.aiReadPhotos && aiReady ? "On" : automation.cfg.aiReadPhotos ? "Waiting for AI key" : "Off"} · photos read by AI on upload</li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-400">Automation prepares work and reminds people. It never accepts, closes or releases anything.</p>
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
      </div>

      <SystemHealthPanel compact canOpen={actor.permissions.has("system.view")} latest={monitor.latest} lastGood={monitor.lastGood} next={monitor.next} enabled={monitor.enabled} schedulerSilent={monitor.schedulerSilent} running={monitor.running} />

      <Card title={<span id="packs">Returned quality packs ({packsReturned})</span>} actions={<Link href={`/quality-packs?stage=RETURNED${projectId ? `&projectId=${projectId}` : ""}`} className="btn-secondary btn-sm">All returned packs</Link>} pad={false}>
        {packsBack.length === 0 ? <div className="card-pad text-sm text-ink-300">No quality packs returned yet{projectId ? " for this project" : ""}.</div> : (
          <div className="grid gap-0 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Project</th><th className="text-right">Returned</th><th>By discipline</th></tr></thead>
                <tbody>
                  {packsBack.map((c) => (
                    <tr key={c.project.id}>
                      <td><Link className="link font-medium" href={`/projects/${c.project.id}?tab=packs`}>{c.project.code}</Link><div className="max-w-40 truncate text-[11px] text-ink-300">{c.project.name}</div></td>
                      <td className="text-right font-semibold text-ok-400">{c.returned}</td>
                      <td className="text-xs text-ink-300">{Object.entries(c.byDiscipline).filter(([, v]) => v.returned).map(([d, v]) => `${d} ${v.returned}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-700 border-t border-ink-700 text-sm lg:border-l lg:border-t-0">
              {packsRecent.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="text-[11px] text-ink-400">{p.project.code} · {p.discipline}{p.kind === "folder" && (p.fileCount ?? p.files.length) ? ` · ${p.fileCount ?? p.files.length} file(s)` : ""}</div></div>
                  <div className="shrink-0 text-right text-xs text-ink-300">{p.returnedAt ? fmtDate(p.returnedAt) : "date not recorded"}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={<span id="projects">Project health ({health.length} active)</span>} actions={<Link href="/projects" className="btn-secondary btn-sm">Project register</Link>} pad={false}>
        {health.length === 0 ? (
          <div className="p-5"><Empty title="No active projects">Set a project&apos;s status to Active in the Project Register to track it here.</Empty></div>
        ) : (
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead><tr><th>Status</th><th>Project</th><th>Client</th><th>Target</th><th>ITP progress</th><th className="text-right">Inspections</th><th className="text-right">Open NCRs</th><th>Why</th></tr></thead>
              <tbody>
                {health.map((p) => (
                  <tr key={p.id}>
                    <td><Badge tone={RAG_TONE[p.rag]} label={p.rag === "RED" ? "Red" : p.rag === "AMBER" ? "Amber" : "Green"} /></td>
                    <td><Link className="link font-medium" href={`/projects/${p.id}`}>{p.code}</Link> <span className="text-ink-200">{p.name}</span></td>
                    <td>{p.client ?? <span className="text-ink-400">—</span>}</td>
                    <td className="whitespace-nowrap">{p.targetDate ? fmtDate(p.targetDate) : <span className="text-ink-400">—</span>}</td>
                    <td>
                      {p.itp.points ? (
                        <div className="flex items-center gap-2" title={`${p.itp.done} of ${p.itp.points} control points signed or not applicable`}>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-600"><div className="h-full rounded-full bg-ok-500" style={{ width: `${Math.round((p.itp.done / p.itp.points) * 100)}%` }} /></div>
                          <span className="text-xs tabular-nums text-ink-300">{p.itp.done}/{p.itp.points}</span>
                        </div>
                      ) : <span className="text-xs text-warn-400">No ITP</span>}
                    </td>
                    <td className="text-right tabular-nums">{p.inspections}</td>
                    <td className={`text-right tabular-nums ${p.overdueNcrs ? "text-bad-400" : p.openNcrs ? "text-warn-400" : ""}`}>{p.openNcrs}</td>
                    <td className="text-xs text-ink-300">{p.reasons.join(" · ") || "No issues found by the rules"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-2 text-[11px] text-ink-400">Red: an overdue NCR, a Critical alert, or the target date has passed. Amber: no ITP, no inspections, an open NCR, or a High alert. Fixed rules read from the records, not an assessment.</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr] [&>*]:min-w-0">
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

      <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
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

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <Card title="NCR ageing (open NCRs)">
          <Bars data={k.ncrAgeing.map((b) => ({ key: b.label, count: b.count }))} colors={["#1fb894", "#1fb894", "#f0a531", "#f97316", "#e5484d"]} />
        </Card>
        <Card title="Alerts by severity" actions={<Link href="/alerts" className="link text-xs">Open alerts</Link>}>
          <Bars data={[{ key: "Critical", count: alerts.bySeverity.CRITICAL }, { key: "High", count: alerts.bySeverity.HIGH }, { key: "Medium", count: alerts.bySeverity.MEDIUM }, { key: "Low", count: alerts.bySeverity.LOW }, { key: "Info", count: alerts.bySeverity.INFO }]} colors={["#e5484d", "#f97316", "#f0a531", "#1fb894", "#7d8fa3"]} />
          <p className="mt-2 text-xs text-ink-300">{urgentAlerts} urgent · {alerts.ageing["> 30 days"]} open longer than 30 days</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiGroup title="Inspections" href="/inspections" rows={[
          ["Total in period", k.inspections.total, d("totalInspections")],
          ["Completed", k.inspections.completed, d("completedInspections")],
          ["Pending", k.inspections.pending],
          ["Overdue", k.inspections.overdue, d("overdueInspections"), k.inspections.overdue ? "warn" : undefined],
          ["Evidence gaps", k.evidence.missing, d("missingEvidence"), k.evidence.missing ? "warn" : undefined],
        ]} />
        <KpiGroup title="NCR & corrective action" href="/ncr?status=OPEN_ALL" rows={[
          ["Open NCRs", k.ncrs.open, d("openNcrs"), k.ncrs.open ? "warn" : undefined],
          ["Overdue NCRs", k.ncrs.overdue, d("overdueNcrs"), k.ncrs.overdue ? "bad" : undefined],
          ["Open corrective actions", k.actions.open, d("openActions")],
          ["Overdue actions", k.actions.overdue, undefined, k.actions.overdue ? "bad" : undefined],
          ["Audit actions outstanding", k.audit.outstanding, d("outstandingAudit")],
        ]} />
        <KpiGroup title="Welding, materials & NDT" href="/welding?tab=analytics" rows={[
          ["Weld defects confirmed", k.weldDefects.total, d("weldDefects")],
          ["Rework records", k.rework.volume, `${d("reworkVolume")} ${d("reworkCost")}`],
          ["Material exceptions", k.materials.exceptions, d("materialExceptions"), k.materials.exceptions ? "warn" : undefined],
          ["Quarantined materials", k.materials.quarantined, undefined, k.materials.quarantined ? "bad" : undefined],
          ["NDT reports outstanding", k.ndt.outstanding, d("outstandingNdt"), k.ndt.outstanding ? "warn" : undefined],
        ]} />
        <KpiGroup title="Equipment & release" href="/cmr" rows={[
          ["Open CMRs", cmr.open, "Corrective maintenance requests not yet completed."],
          ["CMRs past requested date", cmr.overdueRequested, undefined, cmr.overdueRequested ? "warn" : undefined],
          ["Equipment unavailable", cmr.unavailable, "Open CMRs reported with the equipment unavailable for production.", cmr.unavailable ? "bad" : undefined],
          ["Frames released", `${k.release.releasedUnits} / ${k.release.units}`, d("releasedUnits")],
          ["Projects awaiting release", k.projects.awaitingRelease],
        ]} />
      </div>
      <p className="text-[11px] text-ink-400">Hover a figure for its definition. Full KPI definitions: <Link className="link" href="/analytics?tab=definitions">Analytics → KPI definitions</Link>.</p>
    </div>
  );
}
