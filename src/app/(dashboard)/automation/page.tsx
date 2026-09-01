"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import {
  Zap, Plus, Play, Pause, Trash2, Clock, Link2, X, Loader2,
  Mail, MessageSquare, Database, ShoppingBag, CreditCard, Calendar, Calculator,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatRelativeTime } from "@/lib/utils";

interface Workflow {
  id: string; name: string; description?: string | null; trigger: string; action: string;
  isActive: boolean; runCount: number; lastRunAt: string | null; createdAt: string;
}

interface Integration {
  provider: string; status: string; accountId: string | null; connectedAt: string | null;
}

const PROVIDER_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  gmail:      { label: "Gmail",      icon: Mail,          color: "from-red-500 to-orange-500"    },
  slack:      { label: "Slack",      icon: MessageSquare, color: "from-purple-500 to-indigo-500" },
  shopify:    { label: "Shopify",    icon: ShoppingBag,   color: "from-green-600 to-teal-500"    },
  stripe:     { label: "Stripe",     icon: CreditCard,    color: "from-blue-500 to-indigo-500"   },
  hubspot:    { label: "HubSpot",    icon: Database,      color: "from-orange-500 to-red-500"    },
  whatsapp:   { label: "WhatsApp",   icon: MessageSquare, color: "from-green-500 to-emerald-500" },
  calendar:   { label: "Calendar",   icon: Calendar,      color: "from-blue-600 to-cyan-500"     },
  quickbooks: { label: "QuickBooks", icon: Calculator,    color: "from-teal-500 to-green-600"    },
};

const TRIGGERS = ["New contact", "Deal won", "Document uploaded", "Campaign published", "Call completed", "Schedule"];
const ACTIONS  = ["Send email", "Post to Slack", "Create task", "Update CRM", "Generate report", "Notify team"];

export default function AutomationPage() {
  const workflows    = useResource<Workflow[]>("/api/workflows");
  const integrations = useResource<Integration[]>("/api/integrations");

  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ name: "", description: "", trigger: TRIGGERS[0], action: ACTIONS[0] });

  async function createWorkflow() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await mutate("/api/workflows", "POST", { ...form, name: form.name.trim(), isActive: true });
      await workflows.refresh();
      setShowNew(false);
      setForm({ name: "", description: "", trigger: TRIGGERS[0], action: ACTIONS[0] });
      toast.success("Workflow created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the workflow");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWorkflow(w: Workflow) {
    try {
      await mutate(`/api/workflows/${w.id}`, "PATCH", { isActive: !w.isActive });
      await workflows.refresh();
      toast.success(w.isActive ? "Workflow paused" : "Workflow activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the workflow");
    }
  }

  async function deleteWorkflow(id: string) {
    try {
      await mutate(`/api/workflows/${id}`, "DELETE");
      await workflows.refresh();
      toast.success("Workflow deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the workflow");
    }
  }

  async function toggleIntegration(provider: string, connected: boolean) {
    try {
      await mutate("/api/integrations", "POST", {
        provider,
        status: connected ? "disconnected" : "connected",
      });
      await integrations.refresh();
      toast.success(connected ? `${PROVIDER_META[provider].label} disconnected` : `${PROVIDER_META[provider].label} enabled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the integration");
    }
  }

  const list       = workflows.data ?? [];
  const activeList = list.filter((w) => w.isActive);
  const totalRuns  = list.reduce((sum, w) => sum + w.runCount, 0);
  const connected  = (integrations.data ?? []).filter((i) => i.status === "connected");

  return (
    <div className="flex flex-col h-full">
      <Header title="Automation Center" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Workflows", value: activeList.length,  icon: Zap,   color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Total Workflows",  value: list.length,        icon: Play,  color: "text-green-400",  bg: "bg-green-500/10"  },
            { label: "Total Runs",       value: totalRuns,          icon: Clock, color: "text-blue-400",   bg: "bg-blue-500/10"   },
            { label: "Connected Apps",   value: connected.length,   icon: Link2, color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Integrations */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Integrations</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Enabling an app records it against your account. Each provider still needs its own API credentials configured before data flows.
          </p>

          {integrations.loading ? (
            <LoadingState label="Loading integrations…" />
          ) : integrations.error ? (
            <ErrorState message={integrations.error} onRetry={integrations.refresh} />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {(integrations.data ?? []).map((int) => {
                const meta = PROVIDER_META[int.provider];
                if (!meta) return null;
                const isConnected = int.status === "connected";
                return (
                  <button
                    key={int.provider}
                    onClick={() => toggleIntegration(int.provider, isConnected)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      isConnected ? "border-brand-500/50 bg-brand-500/5" : "border-slam-border hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center`}>
                      <meta.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-center text-slate-400">{meta.label}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-slate-600"}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflows */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Automation Workflows</h3>
            <button onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />New Workflow
            </button>
          </div>

          {workflows.loading ? (
            <LoadingState label="Loading workflows…" />
          ) : workflows.error ? (
            <ErrorState message={workflows.error} onRetry={workflows.refresh} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No workflows yet"
              description="Create a workflow to connect a trigger in one part of the platform to an action in another."
              action={<button onClick={() => setShowNew(true)} className="btn-primary text-sm">Create your first workflow</button>}
            />
          ) : (
            <div className="space-y-3">
              {list.map((w) => (
                <div key={w.id} className="flex items-center gap-4 p-4 bg-slam-dark rounded-xl border border-slam-border hover:border-slate-600 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{w.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {w.trigger} → {w.action} · {w.runCount} {w.runCount === 1 ? "run" : "runs"}
                      {w.lastRunAt && ` · last ${formatRelativeTime(w.lastRunAt)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      w.isActive ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {w.isActive ? "active" : "paused"}
                    </span>
                    <button onClick={() => toggleWorkflow(w)} title={w.isActive ? "Pause" : "Activate"} className="text-slate-600 hover:text-slate-300 transition-colors">
                      {w.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteWorkflow(w.id)} title="Delete" className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New workflow modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slam-border">
              <h2 className="font-bold">New Workflow</h2>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="New lead → welcome email"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">When this happens</label>
                <select value={form.trigger} onChange={(e) => setForm((p) => ({ ...p, trigger: e.target.value }))} className="input-field">
                  {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Do this</label>
                <select value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} className="input-field">
                  {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What should this workflow achieve?"
                  className="input-field min-h-[80px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createWorkflow} disabled={!form.name.trim() || saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
