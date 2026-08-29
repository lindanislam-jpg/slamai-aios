"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import Header from "@/components/dashboard/Header";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Bot, Users, FileText, Megaphone, TrendingUp, Sparkles, Clock, BarChart3, Kanban, Activity,
} from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useResource } from "@/lib/useApi";
import { LoadingState, ErrorState } from "@/components/dashboard/States";
import SetupChecklist from "@/components/dashboard/SetupChecklist";

interface ActivityItem { kind: "contact" | "agent" | "campaign" | "document"; text: string; at: string }

interface Stats {
  agents: number; contacts: number; documents: number; campaigns: number;
  projects: number; conversations: number; activeWorkflows: number; websites: number;
  totalRevenue: number; pipelineValue: number; totalDeals: number;
  chart: { month: string; revenue: number; leads: number }[];
  activity: ActivityItem[];
}

const ACTIVITY_STYLE = {
  contact:  { icon: Users,     color: "text-blue-400"   },
  agent:    { icon: Bot,       color: "text-purple-400" },
  campaign: { icon: Megaphone, color: "text-pink-400"   },
  document: { icon: FileText,  color: "text-green-400"  },
} as const;

const quickActions = [
  { href: "/agents",    label: "Deploy Agent",   icon: Bot,       color: "from-purple-600 to-indigo-600" },
  { href: "/crm",       label: "Add Contact",    icon: Users,     color: "from-blue-600 to-cyan-600"     },
  { href: "/marketing", label: "Create Content", icon: Megaphone, color: "from-pink-600 to-rose-600"     },
  { href: "/documents", label: "Analyze Doc",    icon: FileText,  color: "from-green-600 to-emerald-600" },
  { href: "/analytics", label: "View Analytics", icon: BarChart3, color: "from-teal-600 to-green-600"    },
  { href: "/projects",  label: "New Project",    icon: Kanban,    color: "from-orange-600 to-red-600"    },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: stats, loading, error, refresh } = useResource<Stats>("/api/dashboard/stats");

  const firstName = session?.user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const hasChartData = stats?.chart.some((d) => d.revenue > 0 || d.leads > 0);

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Welcome */}
        <div className="glass rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">{greeting}, {firstName} 👋</h2>
            <p className="text-slate-400">Here&apos;s what&apos;s happening across your workspace.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-400 font-medium">All systems operational</span>
          </div>
        </div>

        <SetupChecklist />

        {loading ? (
          <LoadingState label="Loading your workspace…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !stats ? null : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "AI Agents",     value: stats.agents,                        icon: Bot,        color: "text-purple-400", bg: "bg-purple-500/10" },
                { label: "CRM Contacts",  value: stats.contacts,                      icon: Users,      color: "text-blue-400",   bg: "bg-blue-500/10"   },
                { label: "Documents",     value: stats.documents,                     icon: FileText,   color: "text-green-400",  bg: "bg-green-500/10"  },
                { label: "Revenue Won",   value: formatCurrency(stats.totalRevenue),  icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/10" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-5 card-hover">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-slate-100">{s.value}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue chart */}
              <div className="lg:col-span-2 glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Revenue Overview</h3>
                  <span className="text-xs text-slate-500">Last 6 months · closed-won deals</span>
                </div>
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={stats.chart}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }}
                        formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex flex-col items-center justify-center text-center">
                    <BarChart3 className="w-8 h-8 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No revenue recorded yet</p>
                    <p className="text-xs text-slate-600 mt-1 max-w-xs">
                      Mark a deal as won in the CRM and it appears on this chart.
                    </p>
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                {stats.activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Activity className="w-7 h-7 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500">Nothing yet — your activity shows up here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.activity.map((a, i) => {
                      const style = ACTIVITY_STYLE[a.kind];
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slam-dark border border-slam-border flex items-center justify-center flex-shrink-0 mt-0.5">
                            <style.icon className={`w-3.5 h-3.5 ${style.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300 leading-snug">{a.text}</p>
                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />{formatRelativeTime(a.at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Open Pipeline",    value: formatCurrency(stats.pipelineValue) },
                { label: "Deals",            value: stats.totalDeals },
                { label: "Projects",         value: stats.projects },
                { label: "Active Workflows", value: stats.activeWorkflows },
                { label: "Conversations",    value: stats.conversations },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-4 text-center">
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((a) => (
              <Link key={a.href} href={a.href} className="glass rounded-xl p-4 flex flex-col items-center gap-3 card-hover text-center group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <a.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-slate-300">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
