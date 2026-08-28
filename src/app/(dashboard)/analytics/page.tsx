"use client";

import Header from "@/components/dashboard/Header";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, Users, Bot, DollarSign, Target, MessageSquare, BarChart3 } from "lucide-react";
import { useResource } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatCurrency } from "@/lib/utils";

interface Analytics {
  kpis: {
    totalRevenue: number; openPipeline: number; wonDeals: number; totalContacts: number;
    avgLeadScore: number; conversionRate: number; totalMessages: number; activeCampaigns: number;
  };
  revenueSeries: { month: string; revenue: number; leads: number }[];
  pipeline: { stage: string; count: number }[];
  agentUsage: { name: string; messages: number }[];
  channels: { platform: string; reach: number; engagement: number }[];
}

const STAGE_COLORS: Record<string, string> = {
  lead:        "#64748b",
  prospect:    "#3b82f6",
  qualified:   "#06b6d4",
  proposal:    "#6366f1",
  negotiation: "#f59e0b",
  won:         "#10b981",
  lost:        "#ef4444",
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slam-card border border-slam-border rounded-xl p-3 text-sm">
        <p className="text-slate-400 mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{p.name === "revenue" ? formatCurrency(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { data, loading, error, refresh } = useResource<Analytics>("/api/analytics");

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {loading ? (
          <LoadingState label="Crunching your numbers…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !data ? null : (
          <>
            {/* KPI cards — all derived from your own records */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Revenue Won",     value: formatCurrency(data.kpis.totalRevenue), icon: DollarSign,    color: "text-yellow-400", bg: "bg-yellow-500/10" },
                { label: "Open Pipeline",   value: formatCurrency(data.kpis.openPipeline), icon: TrendingUp,    color: "text-green-400",  bg: "bg-green-500/10"  },
                { label: "Contacts",        value: data.kpis.totalContacts,                 icon: Users,         color: "text-blue-400",   bg: "bg-blue-500/10"   },
                { label: "AI Messages",     value: data.kpis.totalMessages,                 icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-500/10" },
              ].map((k) => (
                <div key={k.label} className="glass rounded-xl p-5 card-hover">
                  <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                    <k.icon className={`w-5 h-5 ${k.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue + leads */}
              <div className="lg:col-span-2 glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Revenue &amp; Leads</h3>
                  <span className="text-xs text-slate-500">Last 6 months</span>
                </div>
                {data.revenueSeries.every((d) => d.revenue === 0 && d.leads === 0) ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No activity yet"
                    description="Once you add contacts and close deals, your revenue and lead trend appears here."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={data.revenueSeries}>
                      <defs>
                        <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ledG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left"  tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v / 1000}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                      <Area yAxisId="left"  type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revG)" name="revenue" />
                      <Area yAxisId="right" type="monotone" dataKey="leads"   stroke="#06b6d4" strokeWidth={2} fill="url(#ledG)" name="leads" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pipeline by stage */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold mb-6">Pipeline by Stage</h3>
                {data.pipeline.length === 0 ? (
                  <EmptyState icon={Target} title="No contacts yet" description="Add contacts in the CRM to see how your pipeline splits." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={data.pipeline} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="stage">
                          {data.pipeline.map((p) => <Cell key={p.stage} fill={STAGE_COLORS[p.stage] || "#64748b"} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {data.pipeline.map((p) => (
                        <div key={p.stage} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLORS[p.stage] || "#64748b" }} />
                            <span className="text-slate-400 capitalize">{p.stage}</span>
                          </div>
                          <span className="font-medium">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Agent usage */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-6">Messages per AI Agent</h3>
              {data.agentUsage.length === 0 || data.agentUsage.every((a) => a.messages === 0) ? (
                <EmptyState icon={Bot} title="No conversations yet" description="Chat with an agent in the Agent Hub and its usage shows up here." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, data.agentUsage.length * 42)}>
                  <BarChart data={data.agentUsage} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }} />
                    <Bar dataKey="messages" fill="#6366f1" radius={[0, 6, 6, 0]} name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Derived summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Deals Won",        value: data.kpis.wonDeals },
                { label: "Conversion Rate",  value: `${data.kpis.conversionRate}%` },
                { label: "Avg. Lead Score",  value: data.kpis.avgLeadScore },
                { label: "Active Campaigns", value: data.kpis.activeCampaigns },
              ].map((m) => (
                <div key={m.label} className="glass rounded-xl p-4 text-center card-hover">
                  <div className="text-2xl font-bold">{m.value}</div>
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
