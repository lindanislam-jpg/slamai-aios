"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/dashboard/Header";
import {
  Store, Star, Download, Search, Truck, Building2, Shield, Home,
  HeadphonesIcon, Share2, Calculator, Cpu, Loader2, Check,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface Listing {
  id: string; name: string; description: string; category: string;
  price: number; rating: number; installs: number;
  features: string[]; installed: boolean;
}

// Presentation only — the catalogue itself comes from the database.
const categoryStyle: Record<string, { icon: typeof Truck; color: string }> = {
  Logistics:     { icon: Truck,          color: "from-blue-500 to-cyan-600"     },
  Construction:  { icon: Building2,      color: "from-yellow-500 to-orange-600" },
  Insurance:     { icon: Shield,         color: "from-green-500 to-emerald-600" },
  "Real Estate": { icon: Home,           color: "from-purple-500 to-indigo-600" },
  Support:       { icon: HeadphonesIcon, color: "from-pink-500 to-rose-600"     },
  Marketing:     { icon: Share2,         color: "from-cyan-500 to-blue-600"     },
  Finance:       { icon: Calculator,     color: "from-teal-500 to-green-600"    },
};
const fallbackStyle = { icon: Cpu, color: "from-slate-500 to-slate-700" };

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("All");
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    axios.get<Listing[]>("/api/marketplace")
      .then(r => setListings(r.data))
      .catch(() => toast.error("Could not load the marketplace"))
      .finally(() => setLoading(false));
  }, []);

  async function install(listing: Listing) {
    setInstalling(listing.id);
    try {
      await axios.post(`/api/marketplace/${listing.id}/install`);
      setListings(ls => ls.map(l =>
        l.id === listing.id ? { ...l, installed: true, installs: l.installs + 1 } : l
      ));
      toast.success(`${listing.name} added to your Agent Hub`);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      toast.error(status === 409 ? "You already installed that agent" : "Install failed");
    } finally {
      setInstalling(null);
    }
  }

  const categories = ["All", ...[...new Set(listings.map(l => l.category))].sort()];

  const filtered = listings.filter(l => {
    const matchCat = category === "All" || l.category === category;
    const q = search.toLowerCase();
    const matchSearch = l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const totalInstalls = listings.reduce((s, l) => s + l.installs, 0);
  const avgRating = listings.length
    ? (listings.reduce((s, l) => s + l.rating, 0) / listings.length).toFixed(1)
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
            Install a ready-made agent and it appears in your Agent Hub, configured and ready to chat.
          </p>

          <div className="max-w-lg mx-auto mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="input-field pl-10 w-full"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
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

        {/* Stats, counted from the catalogue */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Available Agents", value: loading ? "—" : String(listings.length) },
            { label: "Total Installs",   value: loading ? "—" : totalInstalls.toLocaleString("en-IE") },
            { label: "Avg. Rating",      value: loading ? "—" : `${avgRating} ⭐` },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-slate-500">
            No agents match that search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(a => {
              const style = categoryStyle[a.category] ?? fallbackStyle;
              const Icon = style.icon;
              return (
                <div key={a.id} className="glass rounded-xl overflow-hidden card-hover group flex flex-col">
                  <div className={`h-2 bg-gradient-to-r ${style.color}`} />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
                          <Star className="w-3 h-3 fill-current" />{a.rating}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-0.5 mt-0.5">
                          <Download className="w-3 h-3" />{a.installs.toLocaleString("en-IE")}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-semibold text-sm mb-1 leading-snug">{a.name}</h3>
                    <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full self-start">{a.category}</span>
                    <p className="text-xs text-slate-500 mt-3 mb-3 leading-relaxed">{a.description}</p>

                    <div className="space-y-1 mb-4">
                      {a.features.slice(0, 3).map(f => (
                        <div key={f} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <div className="w-1 h-1 rounded-full bg-brand-400" />{f}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slam-border mt-auto">
                      <div className="text-sm font-bold">{a.price === 0 ? "Free" : `€${a.price}/mo`}</div>
                      {a.installed ? (
                        <Link
                          href="/agents"
                          className="text-xs py-1.5 px-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1.5 font-semibold"
                        >
                          <Check className="w-3 h-3" /> Installed
                        </Link>
                      ) : (
                        <button
                          onClick={() => install(a)}
                          disabled={installing === a.id}
                          className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {installing === a.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
