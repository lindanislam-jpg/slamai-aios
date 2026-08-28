"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import {
  Globe, Layout, ShoppingBag, BookOpen, Briefcase, Plus, Trash2, X, Loader2,
  ExternalLink, type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatRelativeTime } from "@/lib/utils";

interface Website {
  id: string; name: string; template: string; domain: string | null;
  status: string; visits: number; createdAt: string;
}

const TEMPLATES: { type: string; name: string; icon: LucideIcon; color: string; preview: string }[] = [
  { type: "landing",   name: "Business Landing Page", icon: Layout,      color: "from-blue-500 to-cyan-600",     preview: "Hero section with CTA, features, testimonials, and a contact form." },
  { type: "ecommerce", name: "E-Commerce Store",      icon: ShoppingBag, color: "from-green-500 to-emerald-600", preview: "Product grid, cart, checkout, and payment integration ready." },
  { type: "blog",      name: "Blog / Content Site",   icon: BookOpen,    color: "from-purple-500 to-indigo-600", preview: "Article layout, categories, author profiles, SEO optimised." },
  { type: "portfolio", name: "Portfolio",             icon: Briefcase,   color: "from-orange-500 to-yellow-600", preview: "Showcase work, skills, and contact details." },
  { type: "agency",    name: "Agency Website",        icon: Globe,       color: "from-pink-500 to-rose-600",     preview: "Services, team, case studies, and lead generation forms." },
];

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-500/20 text-slate-400",
  building:  "bg-yellow-500/20 text-yellow-400",
  published: "bg-green-500/20 text-green-400",
};

export default function WebsiteBuilderPage() {
  const { data, loading, error, refresh } = useResource<Website[]>("/api/websites");
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ name: "", template: TEMPLATES[0].type, domain: "" });

  function startFromTemplate(template: string) {
    setForm({ name: "", template, domain: "" });
    setShowNew(true);
  }

  async function createSite() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await mutate("/api/websites", "POST", {
        name:     form.name.trim(),
        template: form.template,
        domain:   form.domain.trim() || undefined,
      });
      await refresh();
      setShowNew(false);
      setForm({ name: "", template: TEMPLATES[0].type, domain: "" });
      toast.success("Site created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the site");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(site: Website, status: string) {
    try {
      await mutate(`/api/websites/${site.id}`, "PATCH", { status });
      await refresh();
      toast.success(status === "published" ? "Site published" : "Site unpublished");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the site");
    }
  }

  async function deleteSite(id: string) {
    try {
      await mutate(`/api/websites/${id}`, "DELETE");
      await refresh();
      toast.success("Site deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the site");
    }
  }

  const sites = data ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header title="Website Builder" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Create and track the sites and landing pages you run.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />New Site
          </button>
        </div>

        {/* Your sites */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-5">Your Websites</h3>

          {loading ? (
            <LoadingState label="Loading your sites…" />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : sites.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No websites yet"
              description="Pick a template below, or create a site from scratch, and it will be tracked here."
            />
          ) : (
            <div className="space-y-3">
              {sites.map((site) => {
                const tpl = TEMPLATES.find((t) => t.type === site.template) || TEMPLATES[0];
                return (
                  <div key={site.id} className="flex items-center gap-4 p-4 bg-slam-dark rounded-xl border border-slam-border hover:border-slate-600 transition-colors">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tpl.color} flex items-center justify-center flex-shrink-0`}>
                      <tpl.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{site.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {tpl.name}
                        {site.domain && <> · <span className="text-brand-400">{site.domain}</span></>}
                        {" · created "}{formatRelativeTime(site.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[site.status] || STATUS_COLORS.draft}`}>
                        {site.status}
                      </span>
                      <button
                        onClick={() => updateStatus(site, site.status === "published" ? "draft" : "published")}
                        className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        {site.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      {site.domain && (
                        <a
                          href={site.domain.startsWith("http") ? site.domain : `https://${site.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-300 transition-colors"
                          title="Open site"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => deleteSite(site.id)} title="Delete" className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Templates */}
        <div>
          <h3 className="font-semibold mb-4">Start from a Template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.type}
                onClick={() => startFromTemplate(t.type)}
                className="glass rounded-xl overflow-hidden card-hover group text-left"
              >
                <div className={`h-32 bg-gradient-to-br ${t.color} relative flex items-center justify-center`}>
                  <t.icon className="w-12 h-12 text-white/40" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />Use this template
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-sm">{t.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{t.preview}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* New site modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slam-border">
              <h2 className="font-bold">New Website</h2>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Site name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Slamai.ie landing page"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Template</label>
                <select value={form.template} onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))} className="input-field">
                  {TEMPLATES.map((t) => <option key={t.type} value={t.type}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Domain (optional)</label>
                <input
                  value={form.domain}
                  onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
                  placeholder="slamai.ie"
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createSite} disabled={!form.name.trim() || saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
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
