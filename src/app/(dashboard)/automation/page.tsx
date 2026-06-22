"use client";

import Header from "@/components/dashboard/Header";
import { Zap, Plus, Play, Pause, Settings, CheckCircle, Clock, TrendingUp, Mail, MessageSquare, Database, FileText, ShoppingBag, CreditCard } from "lucide-react";

const integrations = [
  { name: "Gmail",        icon: Mail,          connected: true,  color: "from-red-500 to-orange-500"     },
  { name: "Slack",        icon: MessageSquare, connected: true,  color: "from-purple-500 to-indigo-500"  },
  { name: "Google Sheets",icon: Database,      connected: false, color: "from-green-500 to-emerald-500"  },
  { name: "Stripe",       icon: CreditCard,    connected: true,  color: "from-blue-500 to-indigo-500"    },
  { name: "Shopify",      icon: ShoppingBag,   connected: false, color: "from-green-600 to-teal-500"     },
  { name: "OneDrive",     icon: FileText,      connected: true,  color: "from-blue-600 to-cyan-500"      },
];

const workflows = [
  { name: "New Lead → Welcome Email",       status: "active",   runs: 142, saved: "8h",   trigger: "CRM",   icon: Mail       },
  { name: "Invoice Created → PDF + Slack",  status: "active",   runs: 67,  saved: "3.5h", trigger: "Finance",icon: CreditCard },
  { name: "Support Ticket → AI Response",   status: "active",   runs: 891, saved: "44h",  trigger: "Support",icon: MessageSquare },
  { name: "New Order → Update Sheets",      status: "paused",   runs: 23,  saved: "1.2h", trigger: "Shopify",icon: ShoppingBag   },
  { name: "Monthly Report Generator",       status: "scheduled",runs: 6,   saved: "12h",  trigger: "Cron",   icon: FileText   },
];

export default function AutomationPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Automation Center" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Workflows",   value: "3",     icon: Zap,         color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Total Runs Today",   value: "1,129", icon: Play,        color: "text-green-400",  bg: "bg-green-500/10"  },
            { label: "Hours Saved",        value: "68.7h", icon: Clock,       color: "text-blue-400",   bg: "bg-blue-500/10"   },
            { label: "Connected Apps",     value: "4",     icon: TrendingUp,  color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Integrations */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Connected Integrations</h3>
            <button className="btn-secondary text-sm py-1.5 px-4 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Integration</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {integrations.map(int => (
              <div key={int.name} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${int.connected ? "border-brand-500/50 bg-brand-500/5" : "border-slam-border hover:border-slate-600"}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${int.color} flex items-center justify-center`}>
                  <int.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-center text-slate-400">{int.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${int.connected ? "bg-green-400" : "bg-slate-600"}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Workflows */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Automation Workflows</h3>
            <button className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />New Workflow</button>
          </div>
          <div className="space-y-3">
            {workflows.map(w => (
              <div key={w.name} className="flex items-center gap-4 p-4 bg-slam-dark rounded-xl border border-slam-border hover:border-slate-600 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                  <w.icon className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{w.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Trigger: {w.trigger} · {w.runs} runs · {w.saved} saved</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    w.status === "active"    ? "bg-green-500/20 text-green-400" :
                    w.status === "paused"    ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>{w.status}</span>
                  <button className="text-slate-600 hover:text-slate-400">
                    {w.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="text-slate-600 hover:text-slate-400"><Settings className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* n8n CTA */}
        <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-lg">Visual Workflow Builder</h3>
            <p className="text-slate-400 text-sm mt-1">Powered by n8n — build complex automations visually with 350+ connectors. No code required.</p>
          </div>
          <button className="btn-primary flex items-center gap-2 flex-shrink-0">
            <CheckCircle className="w-4 h-4" />Open Builder
          </button>
        </div>
      </div>
    </div>
  );
}
