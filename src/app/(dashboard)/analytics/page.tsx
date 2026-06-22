"use client";

import Header from "@/components/dashboard/Header";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Users, Bot, Zap, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

const revenueData = [
  { month: "Jan", revenue: 4200, leads: 24, aiCalls: 340 },
  { month: "Feb", revenue: 5800, leads: 31, aiCalls: 420 },
  { month: "Mar", revenue: 7200, leads: 45, aiCalls: 580 },
  { month: "Apr", revenue: 6400, leads: 38, aiCalls: 510 },
  { month: "May", revenue: 9100, leads: 62, aiCalls: 720 },
  { month: "Jun", revenue: 11400, leads: 78, aiCalls: 890 },
  { month: "Jul", revenue: 10200, leads: 71, aiCalls: 830 },
];

const channelData = [
  { name: "LinkedIn",  value: 35, color: "#0077b5" },
  { name: "Email",     value: 28, color: "#6366f1" },
  { name: "Direct",    value: 20, color: "#06b6d4" },
  { name: "Referral",  value: 12, color: "#10b981" },
  { name: "Other",     value: 5,  color: "#64748b" },
];

const agentUsage = [
  { name: "Support", calls: 1240 },
  { name: "Sales",   calls: 890  },
  { name: "Marketing",calls: 620 },
  { name: "Finance", calls: 340  },
  { name: "HR",      calls: 210  },
];

const kpis = [
  { label: "Monthly Revenue",   value: "€11,400",  change: "+18.2%", up: true,  icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { label: "New Leads",         value: "78",       change: "+26%",   up: true,  icon: Users,      color: "text-blue-400",   bg: "bg-blue-500/10"   },
  { label: "AI Agent Calls",    value: "890",      change: "+23%",   up: true,  icon: Bot,        color: "text-purple-400", bg: "bg-purple-500/10" },
  { label: "Automation Saves",  value: "142 hrs",  change: "+11%",   up: true,  icon: Zap,        color: "text-green-400",  bg: "bg-green-500/10"  },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slam-card border border-slam-border rounded-xl p-3 text-sm">
        <p className="text-slate-400 mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{typeof p.value === "number" && p.name === "revenue" ? `€${p.value.toLocaleString()}` : p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="glass rounded-xl p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
                <span className={`text-xs flex items-center gap-0.5 font-medium ${k.up ? "text-green-400" : "text-red-400"}`}>
                  {k.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{k.change}
                </span>
              </div>
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue + Leads chart */}
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Revenue & Leads</h3>
              <div className="flex gap-2">
                {["7D","1M","3M","1Y"].map(t => (
                  <button key={t} className={`px-2.5 py-1 rounded-md text-xs transition-all ${t === "3M" ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>{t}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueData}>
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
                <YAxis yAxisId="left"  tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v/1000}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Area yAxisId="left"  type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revG)"  name="revenue" />
                <Area yAxisId="right" type="monotone" dataKey="leads"   stroke="#06b6d4" strokeWidth={2} fill="url(#ledG)"  name="leads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Traffic sources pie */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-6">Lead Sources</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {channelData.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {channelData.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-slate-400">{c.name}</span>
                  </div>
                  <span className="font-medium">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Agent Usage */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-6">AI Agent Usage This Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, color: "#f1f5f9" }} />
              <Bar dataKey="calls" fill="#6366f1" radius={[0, 6, 6, 0]} name="AI Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Avg. Response Time", value: "1.2s",  icon: "⚡", change: "-0.3s",   up: true  },
            { label: "Customer Satisfaction", value: "94%", icon: "⭐", change: "+2%",     up: true  },
            { label: "Automation Rate",      value: "78%",  icon: "🤖", change: "+12%",    up: true  },
            { label: "Cost per Lead",        value: "€4.20",icon: "💰", change: "-€1.10",  up: true  },
          ].map(m => (
            <div key={m.label} className="glass rounded-xl p-4 text-center card-hover">
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
              <div className={`text-xs mt-2 ${m.up ? "text-green-400" : "text-red-400"} flex items-center justify-center gap-0.5`}>
                <TrendingUp className="w-3 h-3" />{m.change}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
