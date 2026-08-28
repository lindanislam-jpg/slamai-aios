"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import {
  Store, Star, Download, Search, Check, Loader2, Truck, Building2, Shield, Home,
  Headphones, Share2, Calculator, Cpu, Megaphone, HardHat, ShieldCheck, type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";

interface MarketAgent {
  id: string; name: string; description: string; category: string;
  icon: string | null; price: number; rating: number; installs: number; installed: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  Truck, Building2, Shield, ShieldCheck, Home, Headphones, Share2,
  Calculator, Cpu, Megaphone, HardHat,
};

const CATEGORY_COLORS: Record<string, string> = {
  Logistics:    "from-blue-500 to-cyan-600",
  Construction: "from-yellow-500 to-orange-600",
  Insurance:    "from-green-500 to-emerald-600",
  "Real Estate":"from-purple-500 to-indigo-600",
  Support:      "from-pink-500 to-rose-600",
  Marketing:    "from-cyan-500 to-blue-600",
  Finance:      "from-teal-500 to-green-600",
  Custom:       "from-slate-500 to-slate-700",
};

export default function MarketplacePage() {
  const { data, loading, error, refresh } = useResource<MarketAgent[]>("/api/marketplace");
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("All");
  const [busyId, setBusyId]     = useState<string | null>(null);

  const agents = data ?? [];
  const categories = ["All", ...Array.from(new Set(agents.map((a) => a.category))).sort()];

  const filtered = agents.filter((a) => {
    const matchCat = category === "All" || a.category === category;
    const q = search.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  async function toggleInstall(agent: MarketAgent) {
    setBusyId(agent.id);
    try {
      if (agent.installed) {
        await mutate("/api/marketplace/install", "DELETE", { agentId: agent.id });
        toast.success(`${agent.name} uninstalled`);
      } else {
        await mutate("/api/marketplace/install", "POST", { agentId: agent.id });
        toast.success(`${agent.name} installed — find it in your Agent Hub`);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this install");
    } finally {
      setBusyId(null);
    }
  }

  const totalInstalls = agents.reduce((s, a) => s + a.installs, 0);
  const avgRating = agents.length
    ? (agents.reduce((s, a) => s + a.rating, 0) / agents.length).toFixed(1)
    : "—";

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Marketplace" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Hero */}
        <div className="glass rounded-2xl p-8 text-center bg-gradient-to-r from-brand-950/50 to-slam-card relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-glow opacity-50 pointer-events-none" />
          <Store className="w-10 h-10 text-brand-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">AI Agent Marketplace</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Install an industry-specific agent and it appears in your Agent Hub, ready to chat, with its instructions already set up.
          </p>
          <div className="max-w-md mx-auto mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading the marketplace…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Store}
            title="The marketplace is empty"
            description="No agents have been published yet. Run the seed script to load the starter catalogue."
          />
        ) : (
          <>
            {/* Categories */}
            <div className="flex gap-2 flex-wrap">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    category === c ? "bg-brand-600 text-white" : "bg-slam-card border border-slam-border text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Available Agents", value: agents.length },
                { label: "Total Installs",   value: totalInstalls.toLocaleString() },
                { label: "Avg. Rating",      value: `${avgRating} ⭐` },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold gradient-text">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Agent grid */}
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try a different search term or category." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((a) => {
                  const Icon = (a.icon && ICONS[a.icon]) || Cpu;
                  const color = CATEGORY_COLORS[a.category] || "from-slate-500 to-slate-700";
                  const busy = busyId === a.id;
                  return (
                    <div key={a.id} className="glass rounded-xl overflow-hidden card-hover group flex flex-col">
                      <div className={`h-2 bg-gradient-to-r ${color}`} />
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
                              <Star className="w-3 h-3 fill-current" />{a.rating}
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-0.5 mt-0.5">
                              <Download className="w-3 h-3" />{a.installs.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <h3 className="font-semibold text-sm mb-1 leading-snug">{a.name}</h3>
                        <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full self-start">{a.category}</span>
                        <p className="text-xs text-slate-500 mt-3 mb-4 leading-relaxed flex-1">{a.description}</p>

                        <div className="flex items-center justify-between pt-3 border-t border-slam-border">
                          <div className="text-sm font-bold">{a.price === 0 ? "Free" : `€${a.price}/mo`}</div>
                          <button
                            onClick={() => toggleInstall(a)}
                            disabled={busy}
                            className={`text-xs py-1.5 px-4 rounded-lg font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                              a.installed
                                ? "bg-slam-dark border border-slam-border text-slate-400 hover:text-red-400"
                                : "btn-primary"
                            }`}
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" />
                              : a.installed ? <><Check className="w-3 h-3" />Installed</>
                              : "Install"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
