"use client";

import Link from "next/link";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowRight, Bot, Calendar, CheckCircle2, Circle, Clock, Flame, PhoneCall,
  PhoneMissed, TrendingUp, Users, Zap,
} from "lucide-react";
import { useApi } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader, Stat,
} from "@/components/voice/ui";
import { formatDuration } from "@/lib/utils";
import { formatInZone } from "@/lib/voice/hours";
import { bandFor, BAND_LABELS } from "@/lib/voice/scoring";

type DashboardData = {
  stats: {
    callsToday: number; callsThisWeek: number; aiAnswered: number; missedCalls: number;
    leadsCaptured: number; appointmentsBooked: number; transfers: number;
    averageDurationSec: number; conversionRate: number; estimatedRevenue: number;
  };
  timeseries: { date: string; calls: number; leads: number; appointments: number; aiHandled: number }[];
  activity: {
    id: string; fromNumber: string; startedAt: string; summary: string | null;
    outcome: string; durationSec: number; isEmergency: boolean;
    customer: { name: string | null } | null;
    lead: { score: number } | null;
    appointments: { id: string }[];
  }[];
  outcomes: { outcome: string; count: number }[];
  usage: { minutesUsed: number; minutesIncluded: number | null; minutesPercent: number | null };
  business: { name: string; isDemo: boolean; timezone: string } | null;
  checklist: { knowledge: boolean; services: boolean; phone: boolean; agentLive: boolean };
  timezone: string;
};

const OUTCOME_COLORS: Record<string, string> = {
  booked: "#10b981",
  lead_captured: "#6366f1",
  transferred: "#f59e0b",
  message_taken: "#06b6d4",
  info_only: "#64748b",
  answered: "#818cf8",
  missed: "#ef4444",
  failed: "#f43f5e",
};

const OUTCOME_LABELS: Record<string, string> = {
  booked: "Appointment booked",
  lead_captured: "Lead captured",
  transferred: "Transferred to a person",
  message_taken: "Message taken",
  info_only: "Question answered",
  answered: "Answered",
  missed: "Missed",
  failed: "Failed",
};

export default function DashboardPage() {
  const { data, loading, error, refresh } = useApi<DashboardData>("/api/v1/dashboard");

  if (loading) return <Loading label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const { stats, checklist } = data;
  const setupDone = checklist.knowledge && checklist.services && checklist.phone && checklist.agentLive;

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}${data.business?.name ? `, ${data.business.name}` : ""}`}
        description="Everything your AI receptionist has handled, at a glance."
        action={
          <Link href="/app/test">
            <Button icon={<Zap className="h-4 w-4" />}>Test your AI</Button>
          </Link>
        }
      />

      {data.business?.isDemo && (
        <Card className="mb-6 border-amber-500/25 bg-amber-500/[0.06] p-4">
          <div className="flex items-center gap-3 text-[13px] text-amber-200">
            <Badge tone="warning">Demo workspace</Badge>
            This workspace is filled with sample data so you can see how SlamAI Voice looks in use. No real calls
            are being answered here.
          </div>
        </Card>
      )}

      {!setupDone && <SetupChecklist checklist={checklist} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Calls today" value={stats.callsToday} icon={<PhoneCall className="h-5 w-5" />} sub={`${stats.callsThisWeek} this week`} />
        <Stat label="AI answered" value={stats.aiAnswered} tone="success" icon={<Bot className="h-5 w-5" />} sub={`${stats.transfers} passed to a person`} />
        <Stat label="Leads" value={stats.leadsCaptured} tone="brand" icon={<Users className="h-5 w-5" />} sub={`${stats.conversionRate}% of calls this week`} />
        <Stat label="Appointments" value={stats.appointmentsBooked} tone="info" icon={<Calendar className="h-5 w-5" />} sub="booked today" />
        <Stat
          label="Missed"
          value={stats.missedCalls}
          tone={stats.missedCalls > 0 ? "danger" : "success"}
          icon={<PhoneMissed className="h-5 w-5" />}
          sub={stats.missedCalls === 0 ? "Nothing slipped through" : "Nobody picked these up"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Calls and leads"
            description="The last 14 days."
            action={
              <Link href="/app/analytics" className="text-[13px] text-indigo-300 hover:text-indigo-200">
                Full analytics →
              </Link>
            }
          />
          <div className="h-[280px] px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeseries}>
                <defs>
                  <linearGradient id="calls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <RTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="calls" name="Calls" stroke="#6366f1" strokeWidth={2} fill="url(#calls)" />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#10b981" strokeWidth={2} fill="url(#leads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="What happened on calls" description="Last 30 days." />
          {data.outcomes.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-slate-500">No calls yet.</p>
          ) : (
            <>
              <div className="h-[190px] py-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.outcomes} dataKey="count" nameKey="outcome" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                      {data.outcomes.map((entry) => (
                        <Cell key={entry.outcome} fill={OUTCOME_COLORS[entry.outcome] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTooltip labels={OUTCOME_LABELS} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 px-5 pb-5">
                {data.outcomes.map((o) => (
                  <div key={o.outcome} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_COLORS[o.outcome] ?? "#64748b" }} />
                      {OUTCOME_LABELS[o.outcome] ?? o.outcome}
                    </span>
                    <span className="font-medium text-slate-200">{o.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Live activity"
            description="The most recent calls your AI has handled."
            action={
              <Link href="/app/calls" className="text-[13px] text-indigo-300 hover:text-indigo-200">
                All calls →
              </Link>
            }
          />
          {data.activity.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-slate-300">No calls yet.</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
                Once your number is connected and your receptionist is switched on, every call will appear here in real time.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {data.activity.map((call) => {
                const band = call.lead ? bandFor(call.lead.score) : null;
                return (
                  <li key={call.id}>
                    <Link href={`/app/calls/${call.id}`} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-medium text-slate-200">
                            {call.customer?.name ?? call.fromNumber}
                          </span>
                          {call.isEmergency && <Badge tone="danger">Urgent</Badge>}
                          {call.appointments.length > 0 && <Badge tone="success">Booked</Badge>}
                          {band && (
                            <Badge tone={band === "hot" ? "warning" : band === "warm" ? "info" : "neutral"}>
                              {BAND_LABELS[band].icon} {call.lead?.score}/100
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                          {call.summary ?? "Call in progress…"}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatInZone(call.startedAt, data.timezone, { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                          <span>{formatDuration(call.durationSec)}</span>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">This month&apos;s minutes</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[28px] font-semibold leading-none text-white">{Math.round(data.usage.minutesUsed)}</span>
              <span className="pb-0.5 text-[13px] text-slate-400">
                of {data.usage.minutesIncluded ?? "unlimited"}
              </span>
            </div>
            {data.usage.minutesPercent !== null && (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.usage.minutesPercent > 90 ? "bg-rose-500" : data.usage.minutesPercent > 75 ? "bg-amber-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, data.usage.minutesPercent)}%` }}
                  />
                </div>
                {data.usage.minutesPercent > 75 && (
                  <p className="mt-2 text-[12px] text-amber-300">
                    You&apos;ve used {data.usage.minutesPercent}% of your included minutes.{" "}
                    <Link href="/app/billing" className="underline">Review your plan</Link>
                  </p>
                )}
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" /> Estimated pipeline
            </div>
            <div className="mt-2 text-[28px] font-semibold leading-none text-white">
              €{Math.round(stats.estimatedRevenue).toLocaleString()}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
              An estimate based on the values you set on booked and won leads this week. It is not revenue received.
            </p>
          </Card>

          <Card className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Average call</div>
            <div className="mt-2 text-[28px] font-semibold leading-none text-white">
              {formatDuration(stats.averageDurationSec)}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">Across the last seven days.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function SetupChecklist({ checklist }: { checklist: DashboardData["checklist"] }) {
  const steps = [
    { done: checklist.services, label: "Add your services", href: "/app/settings?tab=services" },
    { done: checklist.knowledge, label: "Teach it about your business", href: "/app/knowledge" },
    { done: checklist.phone, label: "Connect a phone number", href: "/app/settings?tab=phone" },
    { done: checklist.agentLive, label: "Switch your receptionist on", href: "/app/agents" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Card className="mb-4 border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Flame className="h-4 w-4 text-indigo-400" />
            {remaining} step{remaining === 1 ? "" : "s"} left before your AI can answer the phone
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-400">Most businesses finish this in under ten minutes.</p>
        </div>
        <Link href="/app/onboarding">
          <Button size="sm" variant="secondary">Open setup guide</Button>
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px] transition-colors hover:border-indigo-500/30 hover:bg-white/[0.05]"
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-600" />
            )}
            <span className={step.done ? "text-slate-500 line-through" : "text-slate-200"}>{step.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  labels,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { outcome?: string } }[];
  label?: string;
  labels?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#16162e] px-3 py-2 text-[12px] shadow-xl">
      {label && <div className="mb-1 font-medium text-slate-300">{shortDate(label)}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {labels && entry.payload?.outcome
            ? (labels[entry.payload.outcome] ?? entry.payload.outcome)
            : entry.name}
          : <span className="font-medium text-slate-200">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
