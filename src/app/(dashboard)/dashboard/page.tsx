"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Header from "@/components/dashboard/Header";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Bot, Users, FileText, Megaphone, Zap, TrendingUp, ArrowUpRight, Sparkles, Clock, BarChart3, Kanban } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import axios from "axios";

interface Stats {
  agents: number; contacts: number; documents: number; campaigns: number;
  projects: number; conversations: number; totalRevenue: number; totalDeals: number;
}

const chartData = [
  { month: "Jan", revenue: 4200, leads: 24, aiUsage: 340 },
  { month: "Feb", revenue: 5800, leads: 31, aiUsage: 420 },
  { month: "Mar", revenue: 7200, leads: 45, aiUsage: 580 },
  { month: "Apr", revenue: 6400, leads: 38, aiUsage: 510 },
  { month: "May", revenue: 9100, leads: 62, aiUsage: 720 },
  { month: "Jun", revenue: 11400, leads: 78, aiUsage: 890 },
];

const recentActivity = [
  { icon: Bot,      label: "Sales Agent qualified 3 new leads",     time: "2 min ago",  color: "text-purple-400" },
  { icon: Users,    label: "New contact added: Sarah Johnson",       time: "15 min ago", color: "text-blue-400"   },
  { icon: Megaphone,label: "LinkedIn campaign published",            time: "1 hr ago",   color: "text-pink-400"   },
  { icon: FileText, label: "Invoice PDF analyzed and summarized",    time: "2 hrs ago",  color: "text-green-400"  },
  { icon: Zap,      label: "Workflow: new customer onboarded",       time: "3 hrs ago",  color: "text-yellow-400" },
];

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
            { label: "AI Agents",      value: stats?.agents       ?? 0, icon: Bot,       change: "+2",   color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "CRM Contacts",   value: stats?.contacts     ?? 0, icon: Users,     change: "+12%", color: "text-blue-400",   bg: "bg-blue-500/10"   },
            { label: "Documents",      value: stats?.documents    ?? 0, icon: FileText,  change: "+5",   color: "text-green-400",  bg: "bg-green-500/10"  },
            { label: "Total Revenue",  value: formatCurrency(stats?.totalRevenue ?? 0), icon: TrendingUp, change: "+18%", color: "text-yellow-400", bg: "bg-yellow-500/10" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <span className="text-xs text-green-400 flex items-center gap-0.5 font-medium">
                  <ArrowUpRight className="w-3 h-3" />{s.change}
                </span>
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
              <select className="bg-slam-dark border border-slam-border rounded-lg px-3 py-1.5 text-sm text-slate-400 focus:outline-none focus:border-brand-500">
                <option>Last 6 months</option>
                <option>Last year</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v/1000}k`} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }} formatter={(v) => [`€${v}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Activity */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slam-dark border border-slam-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 leading-snug">{a.label}</p>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />{a.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
