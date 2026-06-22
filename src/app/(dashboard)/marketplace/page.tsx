"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import { Store, Star, Download, Search, Filter, Truck, Building2, Shield, Home, HeadphonesIcon, Share2, Calculator, Cpu } from "lucide-react";

const categories = ["All", "Logistics", "Construction", "Insurance", "Real Estate", "Support", "Marketing", "Finance", "Custom"];

const agents = [
  { name: "Logistics Intelligence Agent", category: "Logistics",     rating: 4.9, installs: 1240, price: 49,  icon: Truck,           color: "from-blue-500 to-cyan-600",    desc: "Route optimization, delivery tracking, fleet management, and supply chain automation.",  features: ["Route optimization", "ETA predictions", "Driver notifications", "Shipment tracking"] },
  { name: "Construction Site Manager",    category: "Construction",  rating: 4.7, installs: 890,  price: 79,  icon: Building2,       color: "from-yellow-500 to-orange-600", desc: "Site progress tracking, safety checks, resource allocation, and project reporting.",    features: ["Daily reports", "Safety compliance", "Material tracking", "Subcontractor mgmt"] },
  { name: "Insurance Claims Agent",       category: "Insurance",     rating: 4.8, installs: 654,  price: 99,  icon: Shield,          color: "from-green-500 to-emerald-600", desc: "Process claims, assess risks, answer policy questions, and generate quote comparisons.", features: ["Claims processing", "Risk assessment", "Policy lookup", "Quote generation"] },
  { name: "Real Estate AI Assistant",     category: "Real Estate",   rating: 4.6, installs: 2100, price: 59,  icon: Home,            color: "from-purple-500 to-indigo-600", desc: "Property listings, buyer qualification, appointment booking, and market analysis.",     features: ["Lead qualification", "Property search", "Appointment booking", "Market analysis"] },
  { name: "24/7 Customer Support Agent",  category: "Support",       rating: 4.9, installs: 5600, price: 39,  icon: HeadphonesIcon,  color: "from-pink-500 to-rose-600",     desc: "Handle support tickets, FAQs, and escalations across email, chat, and voice.",        features: ["Multi-channel support", "FAQ automation", "Escalation routing", "CSAT tracking"] },
  { name: "Social Media Manager",         category: "Marketing",     rating: 4.5, installs: 1890, price: 49,  icon: Share2,          color: "from-cyan-500 to-blue-600",     desc: "Content creation, scheduling, engagement monitoring, and performance reporting.",      features: ["Content creation", "Auto-posting", "Engagement tracking", "Analytics reports"] },
  { name: "Accounting & Finance Bot",     category: "Finance",       rating: 4.7, installs: 1120, price: 69,  icon: Calculator,      color: "from-teal-500 to-green-600",    desc: "Invoice generation, expense tracking, financial reports, and tax preparation prep.",  features: ["Invoice generation", "Expense tracking", "P&L reports", "Tax preparation"] },
  { name: "Custom AI Builder",            category: "Custom",        rating: 4.4, installs: 340,  price: 0,   icon: Cpu,             color: "from-slate-500 to-slate-700",   desc: "Build and publish your own industry-specific AI agent and earn recurring revenue.",   features: ["Custom prompts", "Knowledge base", "API integration", "Revenue sharing"] },
];

export default function MarketplacePage() {
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("All");

  const filtered = agents.filter(a => {
    const matchCat    = category === "All" || a.category === category;
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Marketplace" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Hero */}
        <div className="glass rounded-2xl p-8 text-center bg-gradient-to-r from-brand-950/50 to-slam-card relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-glow opacity-50 pointer-events-none" />
          <Store className="w-10 h-10 text-brand-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">AI Agent Marketplace</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Discover and install industry-specific AI agents built by SlamAI and the community. Developers earn recurring revenue from every install.</p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…" className="input-field pl-10 w-full" />
            </div>
            <button className="btn-secondary flex items-center gap-2"><Filter className="w-4 h-4" />Filter</button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${category === c ? "bg-brand-600 text-white" : "bg-slam-card border border-slam-border text-slate-400 hover:text-slate-200"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Available Agents", value: agents.length + "+" },
            { label: "Total Installs",   value: "14,834" },
            { label: "Avg. Rating",      value: "4.7 ⭐" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => (
            <div key={a.name} className="glass rounded-xl overflow-hidden card-hover group">
              <div className={`h-2 bg-gradient-to-r ${a.color}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center`}>
                    <a.icon className="w-5 h-5 text-white" />
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
                <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">{a.category}</span>
                <p className="text-xs text-slate-500 mt-3 mb-3 leading-relaxed">{a.desc}</p>

                <div className="space-y-1 mb-4">
                  {a.features.slice(0, 3).map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-brand-400" />{f}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slam-border">
                  <div className="text-sm font-bold">{a.price === 0 ? "Free" : `€${a.price}/mo`}</div>
                  <button className="btn-primary text-xs py-1.5 px-4">Install</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Developer CTA */}
        <div className="glass rounded-2xl p-8 text-center">
          <Cpu className="w-10 h-10 text-brand-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Build & Monetize Your AI Agent</h3>
          <p className="text-slate-400 mb-6">Create industry-specific AI agents for the SlamAI marketplace and earn recurring revenue from every subscription.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="btn-primary">Start Building</button>
            <button className="btn-secondary">View Developer Docs</button>
          </div>
        </div>
      </div>
    </div>
  );
}
