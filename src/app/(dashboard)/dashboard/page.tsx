"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Header from "@/components/dashboard/Header";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Bot, Users, FileText, Megaphone, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Clock, BarChart3, Kanban, Inbox } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import axios from "axios";

type ActivityKind = "contact" | "agent" | "document" | "campaign" | "project";

interface ActivityItem { kind: ActivityKind; label: string; at: string }

interface Stats {
  agents: number; contacts: number; documents: number; campaigns: number;
  projects: number; conversations: number; totalRevenue: number; totalDeals: number; wonDeals: number;
  series: { label: string; revenue: number; leads: number; aiMessages: number }[];
  changes: { revenue: number | null; leads: number | null };
  activity: ActivityItem[];
}

const activityStyle: Record<ActivityKind, { icon: typeof Bot; color: string }> = {
  contact:  { icon: Users,     color: "text-blue-400"   },
  agent:    { icon: Bot,       color: "text-purple-400" },
  document: { icon: FileText,  color: "text-green-400"  },
  campaign: { icon: Megaphone, color: "text-pink-400"   },
  project:  { icon: Kanban,    color: "text-yellow-400" },
};

const quickActions = [
  { href: "/agents",    label: "Deploy Agent",    icon: Bot,       color: "from-purple-600 to-indigo-600" },
  { href: "/crm",       label: "Add Contact",     icon: Users,     color: "from-blue-600 to-cyan-600"     },
  { href: "/marketing", label: "Create Content",  icon: Megaphone, color: "from-pink-600 to-rose-600"     },
  { href: "/documents", label: "Analyze Doc",     icon: FileText,  color: "from-green-600 to-emerald-600" },
  { href: "/analytics", label: "View Analytics",  icon: BarChart3, color: "from-teal-600 to-green-600"    },
  { href: "/projects",  label: "New Project",     icon: Kanban,    color: "from-orange-600 to-red-600"    },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    axios.get("/api/dashboard/stats")
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  const hasRevenue = Boolean(stats?.series?.some(s => s.revenue > 0));
  const firstName = session?.user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />
      <div className="flex-1 p-6 space-y-6">

        {/* Welcome */}
        <div className="glass rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">{greeting}, {firstName} 👋</h2>
            <p className="text-slate-400">Your AI team is active and working. Here&apos;s what&apos;s happening today.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-400 font-medium">All systems operational</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "AI Agents",      value: stats?.agents    ?? 0, icon: Bot,      change: null,                       color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "CRM Contacts",   value: stats?.contacts  ?? 0, icon: Users,    change: stats?.changes.leads ?? null, color: "text-blue-400",  bg: "bg-blue-500/10"   },
            { label: "Documents",      value: stats?.documents ?? 0, icon: FileText, change: null,                       color: "text-green-400",  bg: "bg-green-500/10"  },
            { label: "Revenue (won)",  value: formatCurrency(stats?.totalRevenue ?? 0), icon: TrendingUp, change: stats?.changes.revenue ?? null, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {s.change !== null && (
                  <span className={`text-xs flex items-center gap-0.5 font-medium ${s.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {s.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {s.change >= 0 ? "+" : ""}{s.change}%
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-slate-100">{s.value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">Revenue Overview</h3>
              <Link href="/analytics" className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                Full analytics →
              </Link>
            </div>
            <p className="text-xs text-slate-500 mb-4">Won deals over the last 6 months.</p>
            {hasRevenue ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats!.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} width={56}
                         tickFormatter={v => (v >= 1000 ? `€${v / 1000}k` : `€${v}`)} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }}
                           cursor={{ fill: "rgba(99,102,241,0.08)" }}
                           formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#3987e5" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center gap-2">
                <Inbox className="w-6 h-6 text-slate-600" />
                <p className="text-sm text-slate-500 max-w-xs">
                  No won deals yet. Close a deal in the CRM and revenue will show up here.
                </p>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            {stats && stats.activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
                <Inbox className="w-6 h-6 text-slate-600" />
                <p className="text-sm text-slate-500">Nothing has happened yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(stats?.activity ?? []).map((a, i) => {
                  const style = activityStyle[a.kind];
                  const Icon = style.icon;
                  return (
                    <div key={`${a.kind}-${i}`} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slam-dark border border-slam-border flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 leading-snug">{a.label}</p>
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

        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map(a => (
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
