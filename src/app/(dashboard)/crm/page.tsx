"use client";

import { useEffect, useState } from "react";
import Header from "@/components/dashboard/Header";
import { Users, Plus, Search, Phone, Mail, Building2, TrendingUp, Star, MoreVertical, Loader2, X, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface Contact { id: string; name: string; email?: string; phone?: string; company?: string; stage: string; score: number; deals: { value: number }[]; createdAt: string; }

const stages = ["lead", "prospect", "qualified", "proposal", "negotiation", "won", "lost"];
const stageColors: Record<string, string> = {
  lead:        "bg-slate-500/20 text-slate-400",
  prospect:    "bg-blue-500/20 text-blue-400",
  qualified:   "bg-cyan-500/20 text-cyan-400",
  proposal:    "bg-purple-500/20 text-purple-400",
  negotiation: "bg-yellow-500/20 text-yellow-400",
  won:         "bg-green-500/20 text-green-400",
  lost:        "bg-red-500/20 text-red-400",
};

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [showAdd,  setShowAdd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", stage: "lead" });

  useEffect(() => { fetchContacts(); }, []);

  async function fetchContacts() {
    try { const r = await axios.get("/api/crm/contacts"); setContacts(r.data); }
    catch { toast.error("Failed to load contacts"); }
    finally { setLoading(false); }
  }

  async function addContact() {
    if (!form.name) return;
    setSaving(true);
    try {
      const r = await axios.post("/api/crm/contacts", form);
      setContacts(prev => [{ ...r.data, deals: [] }, ...prev]);
      setShowAdd(false);
      setForm({ name: "", email: "", phone: "", company: "", stage: "lead" });
      toast.success("Contact added!");
    } catch { toast.error("Failed to add contact"); }
    finally { setSaving(false); }
  }

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.stage === filter;
    return matchSearch && matchFilter;
  });

  const totalValue = contacts.flatMap(c => c.deals).reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col h-full">
      <Header title="CRM System" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Contacts", value: contacts.length,                                   color: "text-blue-400",   bg: "bg-blue-500/10",   icon: Users },
            { label: "Active Leads",   value: contacts.filter(c => c.stage === "lead").length,    color: "text-purple-400", bg: "bg-purple-500/10", icon: Star },
            { label: "Won Deals",      value: contacts.filter(c => c.stage === "won").length,     color: "text-green-400",  bg: "bg-green-500/10",  icon: TrendingUp },
            { label: "Pipeline Value", value: `€${totalValue.toLocaleString()}`,                  color: "text-yellow-400", bg: "bg-yellow-500/10", icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {["all", ...stages.slice(0, 5)].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === s ? "bg-brand-600 text-white" : "bg-slam-card border border-slam-border text-slate-400 hover:text-slate-200"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" className="bg-slam-card border border-slam-border rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500 w-52" />
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Contact</button>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slam-border">
                {["Contact", "Company", "Stage", "Score", "Pipeline", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-400 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">No contacts found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-slam-border/50 hover:bg-slam-dark/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell">
                    <div className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{c.company || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${stageColors[c.stage] || stageColors.lead}`}>{c.stage}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slam-dark rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${c.score}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{c.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    €{c.deals.reduce((s, d) => s + d.value, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-slate-500 hover:text-slate-300"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pipeline kanban preview */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-400" />Sales Pipeline</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {stages.slice(0, 5).map(s => {
              const count = contacts.filter(c => c.stage === s).length;
              return (
                <div key={s} className="glass rounded-xl p-4 text-center card-hover cursor-pointer">
                  <div className="text-2xl font-bold text-slate-100">{count}</div>
                  <div className="text-xs text-slate-500 capitalize mt-1">{s}</div>
                  <ChevronRight className="w-3 h-3 text-slate-600 mx-auto mt-2" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slam-border">
              <h2 className="font-bold">Add Contact</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Full Name *", key: "name", type: "text", ph: "John Smith", icon: Users },
                { label: "Email",       key: "email", type: "email", ph: "john@company.com", icon: Mail },
                { label: "Phone",       key: "phone", type: "tel",   ph: "+353 1 234 5678",  icon: Phone },
                { label: "Company",     key: "company", type: "text", ph: "Acme Corp",       icon: Building2 },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} className="input-field pl-10" />
                  </div>
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Stage</label>
                <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} className="input-field capitalize">
                  {stages.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={addContact} disabled={!form.name || saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
