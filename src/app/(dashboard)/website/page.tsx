"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import { Globe, Layout, ShoppingBag, BookOpen, Briefcase, Plus, Eye, Edit3, Smartphone, Monitor, Tablet, Sparkles, BarChart3, Search, MessageSquare, type LucideIcon } from "lucide-react";

const templates = [
  { name: "Business Landing Page",   type: "landing",    icon: Layout,      color: "from-blue-500 to-cyan-600",    preview: "Clean hero section with CTA, features, testimonials, and contact form." },
  { name: "E-Commerce Store",        type: "ecommerce",  icon: ShoppingBag, color: "from-green-500 to-emerald-600",preview: "Product grid, cart, checkout, and payment integration ready." },
  { name: "Blog / Content Site",     type: "blog",       icon: BookOpen,    color: "from-purple-500 to-indigo-600",preview: "Article layout, categories, author profiles, and SEO optimized." },
  { name: "Portfolio",               type: "portfolio",  icon: Briefcase,   color: "from-orange-500 to-yellow-600",preview: "Showcase work, skills, and contact info in a professional layout." },
  { name: "Agency Website",          type: "agency",     icon: Globe,       color: "from-pink-500 to-rose-600",    preview: "Services, team, case studies, and lead generation forms." },
];

const features = [
  { icon: Sparkles,     label: "AI Content",       desc: "Generate page copy, headlines, and descriptions with AI" },
  { icon: Search,       label: "SEO Optimized",    desc: "Built-in meta tags, sitemaps, and structured data" },
  { icon: BarChart3,    label: "Analytics",         desc: "Visitor tracking, conversion funnels, and heatmaps" },
  { icon: MessageSquare,label: "AI Chatbot",        desc: "Embed your SlamAI agent directly on your website" },
];

export default function WebsiteBuilderPage() {
  const [view, setView] = useState<"monitor" | "tablet" | "smartphone">("monitor");

  return (
    <div className="flex flex-col h-full">
      <Header title="Website Builder" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm mt-1">Build AI-powered websites, landing pages, and stores in minutes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slam-card border border-slam-border rounded-lg p-1">
              {([["monitor", Monitor], ["tablet", Tablet], ["smartphone", Smartphone]] as [string, LucideIcon][]).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v as "monitor" | "tablet" | "smartphone")}
                  className={`p-1.5 rounded-md transition-colors ${view === v ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />New Site</button>
          </div>
        </div>

        {/* Live sites */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Your Websites</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-600 border-2 border-dashed border-slam-border rounded-xl">
            <Globe className="w-12 h-12" />
            <p className="text-center">No websites created yet.<br />Choose a template below to get started.</p>
          </div>
        </div>

        {/* Templates */}
        <div>
          <h3 className="font-semibold mb-4">Start from a Template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.type} className="glass rounded-xl overflow-hidden card-hover group cursor-pointer">
                <div className={`h-32 bg-gradient-to-br ${t.color} relative flex items-center justify-center`}>
                  <t.icon className="w-12 h-12 text-white/40" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/30 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />Preview
                    </button>
                    <button className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/30 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" />Use This
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-sm">{t.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{t.preview}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-5">Everything You Need</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {features.map(f => (
              <div key={f.label} className="flex flex-col gap-3 p-4 bg-slam-dark rounded-xl border border-slam-border hover:border-brand-500/40 transition-colors cursor-pointer">
                <f.icon className="w-6 h-6 text-brand-400" />
                <div>
                  <div className="font-medium text-sm">{f.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
