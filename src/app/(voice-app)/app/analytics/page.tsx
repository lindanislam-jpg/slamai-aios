"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Bot, PhoneForwarded, Target, ThumbsUp, TrendingUp } from "lucide-react";
import { useApi } from "@/lib/voice/client";
import {
  Card, CardHeader, ErrorState, Loading, PageHeader, Select, Stat,
} from "@/components/voice/ui";
import { formatDuration } from "@/lib/utils";
import { OUTCOME_LABELS } from "@/lib/voice/labels";

type Analytics = {
  days: number;
  timeseries: { date: string; calls: number; leads: number; appointments: number; aiHandled: number; transferred: number }[];
  outcomes: { outcome: string; count: number }[];
  sentiment: { sentiment: string; count: number }[];
  performance: {
    totalCalls: number; answeredWithoutHelp: number; escalationRate: number;
    bookingRate: number; leadCaptureRate: number; averageDurationSec: number;
    positiveSentimentRate: number;
  };
  stats: { conversionRate: number; estimatedRevenue: number };
  leads: { total: number; qualified: number; averageScore: number; estimatedPipelineValue: number };
  currency: string;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#818cf8", "#ef4444", "#64748b", "#f43f5e"];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, refresh } = useApi<Analytics>(`/api/v1/analytics?days=${days}`);

  if (loading) return <Loading label="Crunching your numbers…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const { performance } = data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your AI receptionist is performing, and what it is turning into work."
        action={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Calls handled" value={performance.totalCalls} icon={<Bot className="h-5 w-5" />} sub={`${performance.answeredWithoutHelp} without a person`} />
        <Stat label="Booking rate" value={`${performance.bookingRate}%`} tone="success" icon={<Target className="h-5 w-5" />} sub="of calls ended in a booking" />
        <Stat label="Lead capture" value={`${performance.leadCaptureRate}%`} tone="brand" icon={<TrendingUp className="h-5 w-5" />} sub="of calls became a lead" />
        <Stat
          label="Escalation rate"
          value={`${performance.escalationRate}%`}
          tone={performance.escalationRate > 40 ? "warning" : "info"}
          icon={<PhoneForwarded className="h-5 w-5" />}
          sub="needed a person"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Calls, leads and bookings" description={`The last ${data.days} days.`} />
          <div className="h-[300px] px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <RTooltip contentStyle={tooltipStyle} labelFormatter={shortDate} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Line type="monotone" dataKey="calls" name="Calls" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="appointments" name="Appointments" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="How calls ended" />
          <div className="h-[220px] py-4">
            {data.outcomes.length === 0 ? (
              <p className="pt-16 text-center text-[13px] text-slate-500">No calls in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.outcomes} dataKey="count" nameKey="outcome" innerRadius={45} outerRadius={72} paddingAngle={3} stroke="none">
                    {data.outcomes.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [value, OUTCOME_LABELS[name] ?? name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5 px-5 pb-5">
            {data.outcomes.map((o, i) => (
              <div key={o.outcome} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {OUTCOME_LABELS[o.outcome] ?? o.outcome}
                </span>
                <span className="font-medium text-slate-200">{o.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="AI vs human" description="How many calls the AI closed out on its own." />
          <div className="h-[260px] px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <RTooltip contentStyle={tooltipStyle} labelFormatter={shortDate} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Bar dataKey="aiHandled" name="Handled by AI" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="transferred" name="Passed to a person" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <ThumbsUp className="h-3.5 w-3.5" /> Customer sentiment
            </div>
            <div className="mt-3 space-y-2">
              {data.sentiment.length === 0 ? (
                <p className="text-[13px] text-slate-500">Not enough calls yet.</p>
              ) : (
                data.sentiment.map((s) => {
                  const total = data.sentiment.reduce((sum, item) => sum + item.count, 0);
                  const percent = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={s.sentiment}>
                      <div className="flex justify-between text-[13px]">
                        <span className="capitalize text-slate-400">{s.sentiment}</span>
                        <span className="text-slate-300">{percent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full ${
                            s.sentiment === "positive" ? "bg-emerald-500" : s.sentiment === "negative" ? "bg-rose-500" : "bg-slate-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Leads</div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Captured" value={data.leads.total} />
              <Row label="Qualified or better" value={data.leads.qualified} />
              <Row label="Average score" value={`${data.leads.averageScore}/100`} />
              <Row label="Average call" value={formatDuration(performance.averageDurationSec)} />
            </dl>
          </Card>

          <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] to-transparent p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-300">
              Estimated pipeline value
            </div>
            <div className="mt-2 text-[28px] font-semibold leading-none text-white">
              €{Math.round(data.leads.estimatedPipelineValue).toLocaleString()}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
              This is the sum of the values <em>you</em> set on your leads. It is an estimate of potential work, not
              revenue received, and SlamAI does not guarantee it.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-200">{value}</dd>
    </div>
  );
}

const tooltipStyle = {
  background: "#16162e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e2e8f0",
};

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
