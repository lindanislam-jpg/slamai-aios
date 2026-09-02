"use client";

import { useEffect, useState } from "react";
import Header from "@/components/dashboard/Header";
import {
  LineChart, Line, BarChart, Bar, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Bot, DollarSign, ArrowUpRight, ArrowDownRight, Loader2, Inbox, Briefcase,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { STAGE_ORDER, type AnalyticsPayload, type Range } from "@/lib/analytics";
import axios from "axios";

const RANGES: { key: Range; label: string }[] = [
  { key: "7D", label: "7D" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
];

// Categorical slots 1 and 2, stepped for the dark chart surface.
const SERIES_LEADS = "#3987e5";
const SERIES_AI    = "#d95926";
const SERIES_REVENUE = "#3987e5";

// Single-hue ordinal ramp for the pipeline, light to dark in funnel order.
const STAGE_RAMP  = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"];
const STAGE_OTHER = "#64748b";

function stageColor(stage: string) {
  const i = STAGE_ORDER.indexOf(stage.toLowerCase());
  return i === -1 ? STAGE_OTHER : STAGE_RAMP[i];
}

const axisTick = { fill: "#64748b", fontSize: 11 };
const tooltipStyle = {
  background: "#1a1a2e",
  border: "1px solid #2a2a4a",
  borderRadius: 8,
  color: "#f1f5f9",
};

function Change({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-slate-600 font-medium">no prior data</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 font-medium ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2">
      <Inbox className="w-6 h-6 text-slate-600" />
      <p className="text-sm text-slate-500 max-w-xs">{message}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("3M");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    axios.get<AnalyticsPayload>(`/api/analytics?range=${range}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const kpis = data && [
    { label: "Revenue (won deals)", value: formatCurrency(data.kpis.revenue.value), change: data.kpis.revenue.changePct, icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "New contacts",        value: String(data.kpis.leads.value),           change: data.kpis.leads.changePct,   icon: Users,      color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { label: "AI agent replies",    value: String(data.kpis.aiMessages.value),      change: data.kpis.aiMessages.changePct, icon: Bot,     color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Open pipeline",       value: formatCurrency(data.kpis.pipelineValue.value), change: data.kpis.pipelineValue.changePct, icon: Briefcase, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  const hasRevenue = Boolean(data?.series.some(s => s.revenue > 0));
  const hasCounts  = Boolean(data?.series.some(s => s.leads > 0 || s.aiMessages > 0));

  const summary = data && [
    { label: "Total contacts", value: String(data.summary.totalContacts) },
    { label: "Open deals",     value: String(data.summary.openDeals) },
    { label: "Win rate",       value: data.summary.winRatePct === null ? "—" : `${data.summary.winRatePct}%` },
    { label: "Avg. won deal",  value: formatCurrency(data.summary.avgDealValue) },
    { label: "Active agents",  value: String(data.summary.activeAgents) },
    { label: "Campaign reach", value: data.summary.campaignReach.toLocaleString("en-IE") },
    { label: "Engagement",     value: data.summary.engagementRatePct === null ? "—" : `${data.summary.engagementRatePct}%` },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Range filter — one row, above the charts */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : failed ? "Could not load analytics." : "Figures are calculated from your workspace data."}
          </p>
          <div className="flex gap-1 bg-slam-card border border-slam-border rounded-lg p-1">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  range === r.key ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : !data ? (
          <div className="glass rounded-2xl p-10 text-center text-slate-500">
            Analytics are unavailable right now. Try reloading the page.
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis!.map(k => (
                <div key={k.label} className="glass rounded-xl p-5 card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                      <k.icon className={`w-5 h-5 ${k.color}`} />
                    </div>
                    <Change pct={k.change} />
                  </div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Revenue — its own scale, its own chart */}
            <Panel title="Revenue from won deals" subtitle="Booked on each deal's close date.">
              {hasRevenue ? (
                // Bars, not a smoothed line: each point is a discrete period
                // total, and interpolating between them invents revenue.
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56}
                           tickFormatter={v => (v >= 1000 ? `€${v / 1000}k` : `€${v}`)} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(99,102,241,0.08)" }}
                             formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill={SERIES_REVENUE} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty message="No won deals in this period. Mark a deal as won in the CRM and it will appear here." />
              )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Counts — separate chart, shared scale, never a second axis */}
              <div className="lg:col-span-2">
                <Panel title="New contacts & AI replies" subtitle="Both series are counts, so they share one scale.">
                  {hasCounts ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#3a3a5a" }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                        <Line type="linear" dataKey="leads" name="New contacts" stroke={SERIES_LEADS}
                              strokeWidth={2} dot={{ r: 2.5, fill: SERIES_LEADS, strokeWidth: 0 }}
                              activeDot={{ r: 4, strokeWidth: 2, stroke: "#1e1e35" }} />
                        <Line type="linear" dataKey="aiMessages" name="AI replies" stroke={SERIES_AI}
                              strokeWidth={2} dot={{ r: 2.5, fill: SERIES_AI, strokeWidth: 0 }}
                              activeDot={{ r: 4, strokeWidth: 2, stroke: "#1e1e35" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty message="No contacts added or agent conversations held in this period." />
                  )}
                </Panel>
              </div>

              {/* Pipeline — ordered stages, ordinal ramp */}
              <Panel title="Pipeline by stage" subtitle="Every contact, by CRM stage.">
                {data.pipeline.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.pipeline} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="stage" tick={{ fill: "#94a3b8", fontSize: 12 }}
                             axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(99,102,241,0.08)" }}
                               formatter={(v: number) => [v, "Contacts"]} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                        {data.pipeline.map(p => <Cell key={p.stage} fill={stageColor(p.stage)} />)}
                        <LabelList dataKey="count" position="right" fill="#94a3b8" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty message="No contacts yet. Add one in the CRM to see your pipeline." />
                )}
              </Panel>
            </div>

            {/* Agent usage */}
            <Panel title="AI agent usage" subtitle="Assistant replies per agent over the selected range.">
              {data.agentUsage.length ? (
                <ResponsiveContainer width="100%" height={Math.max(160, data.agentUsage.length * 42)}>
                  <BarChart data={data.agentUsage} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" horizontal={false} />
                    <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }}
                           axisLine={false} tickLine={false} width={140} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(99,102,241,0.08)" }}
                             formatter={(v: number) => [v, "Replies"]} />
                    <Bar dataKey="messages" fill={SERIES_REVENUE} radius={[0, 4, 4, 0]} barSize={18}>
                      <LabelList dataKey="messages" position="right" fill="#94a3b8" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty message="No agent replies in this period. Start a conversation from the AI Agent Hub." />
              )}
            </Panel>

            {/* Summary figures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              {summary!.map(m => (
                <div key={m.label} className="glass rounded-xl p-4 text-center card-hover">
                  <div className="text-xl font-bold">{m.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
