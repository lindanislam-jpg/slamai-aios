"use client";

import { Fragment, useEffect, useState } from "react";
import Header from "@/components/dashboard/Header";
import { Users, Plus, Search, Phone, Mail, Building2, TrendingUp, Star, Loader2, X, ChevronRight, ChevronDown, Save, Trash2, Euro } from "lucide-react";
import RowMenu from "@/components/dashboard/RowMenu";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import toast from "react-hot-toast";
import axios from "axios";

interface Deal { id: string; title: string; value: number; stage: string; closeDate?: string | null }
interface Contact { id: string; name: string; email?: string; phone?: string; company?: string; stage: string; score: number; deals: Deal[]; createdAt: string; }

/** Open pipeline excludes closed deals, matching the analytics page. */
const isOpen = (d: Deal) => d.stage !== "won" && d.stage !== "lost";

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
  // Set while editing an existing contact; null means the form creates one.
  const [editing,  setEditing]  = useState<Contact | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const emptyForm = { name: "", email: "", phone: "", company: "", stage: "lead" };
  const [form, setForm] = useState(emptyForm);
  // Row expansion reveals that contact's deals.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState({ title: "", value: "" });
  const [addingDeal, setAddingDeal] = useState(false);
  const [pendingDealDelete, setPendingDealDelete] = useState<Deal | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  async function fetchContacts() {
    try { const r = await axios.get("/api/crm/contacts"); setContacts(r.data); }
    catch { toast.error("Failed to load contacts"); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowAdd(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      stage: c.stage,
    });
    setShowAdd(true);
  }

  async function saveContact() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const r = await axios.patch(`/api/crm/contacts/${editing.id}`, form);
        setContacts(prev => prev.map(c => (c.id === editing.id ? { ...c, ...r.data } : c)));
        toast.success("Contact updated");
      } else {
        const r = await axios.post("/api/crm/contacts", form);
        setContacts(prev => [{ ...r.data, deals: [] }, ...prev]);
        toast.success("Contact added");
      }
      setShowAdd(false);
      setEditing(null);
      setForm(emptyForm);
    } catch {
      toast.error(editing ? "Failed to update contact" : "Failed to add contact");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/crm/contacts/${pendingDelete.id}`);
      setContacts(prev => prev.filter(c => c.id !== pendingDelete.id));
      toast.success("Contact deleted");
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  }

  function replaceDeals(contactId: string, update: (deals: Deal[]) => Deal[]) {
    setContacts(cs => cs.map(c => (c.id === contactId ? { ...c, deals: update(c.deals) } : c)));
  }

  async function addDeal(contactId: string) {
    const value = Number(dealForm.value);
    if (!dealForm.title.trim() || Number.isNaN(value) || value < 0) {
      toast.error("Enter a title and a value");
      return;
    }
    setAddingDeal(true);
    try {
      const r = await axios.post(`/api/crm/contacts/${contactId}/deals`, {
        title: dealForm.title.trim(),
        value,
        stage: "prospect",
      });
      replaceDeals(contactId, ds => [...ds, r.data]);
      setDealForm({ title: "", value: "" });
      toast.success("Deal added");
    } catch {
      toast.error("Failed to add deal");
    } finally { setAddingDeal(false); }
  }

  async function setDealStage(contactId: string, deal: Deal, stage: string) {
    replaceDeals(contactId, ds => ds.map(d => (d.id === deal.id ? { ...d, stage } : d)));
    try {
      const r = await axios.patch(`/api/crm/deals/${deal.id}`, { stage });
      replaceDeals(contactId, ds => ds.map(d => (d.id === deal.id ? r.data : d)));
    } catch {
      replaceDeals(contactId, ds => ds.map(d => (d.id === deal.id ? deal : d)));
      toast.error("Failed to update deal");
    }
  }

  async function deleteDeal() {
    if (!pendingDealDelete || !expanded) return;
    setDeletingDeal(true);
    try {
      await axios.delete(`/api/crm/deals/${pendingDealDelete.id}`);
      replaceDeals(expanded, ds => ds.filter(d => d.id !== pendingDealDelete.id));
      toast.success("Deal deleted");
      setPendingDealDelete(null);
    } catch {
      toast.error("Failed to delete deal");
    } finally { setDeletingDeal(false); }
  }

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.stage === filter;
    return matchSearch && matchFilter;
  });

  const openPipeline = contacts.flatMap(c => c.deals).filter(isOpen).reduce((s, d) => s + d.value, 0);

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
            { label: "Open Pipeline",  value: `€${openPipeline.toLocaleString()}`,                color: "text-yellow-400", bg: "bg-yellow-500/10", icon: TrendingUp },
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
            <button onClick={openAdd} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Contact</button>
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
                <Fragment key={c.id}>
                <tr className="border-b border-slam-border/50 hover:bg-slam-dark/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(e => (e === c.id ? null : c.id))}
                        aria-label={`${expanded === c.id ? "Hide" : "Show"} deals for ${c.name}`}
                        aria-expanded={expanded === c.id}
                        className="text-slate-600 hover:text-slate-300 p-0.5 flex-shrink-0"
                      >
                        {expanded === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
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
                    €{c.deals.filter(isOpen).reduce((s, d) => s + d.value, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={c.name}
                      onEdit={() => openEdit(c)}
                      onDelete={() => setPendingDelete(c)}
                    />
                  </td>
                </tr>

                {expanded === c.id && (
                  <tr className="border-b border-slam-border/50 bg-slam-dark/40">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="pl-8 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          Deals for {c.name}
                        </h4>

                        {c.deals.length === 0 ? (
                          <p className="text-xs text-slate-600 py-1">No deals yet.</p>
                        ) : c.deals.map(d => (
                          <div key={d.id} className="flex items-center gap-3 bg-slam-card border border-slam-border rounded-lg px-3 py-2">
                            <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{d.title}</span>
                            <span className="text-sm text-slate-300 font-medium">€{d.value.toLocaleString()}</span>
                            <select
                              value={d.stage}
                              onChange={e => setDealStage(c.id, d, e.target.value)}
                              aria-label={`Stage for ${d.title}`}
                              className="bg-slam-dark border border-slam-border rounded px-2 py-1 text-xs text-slate-300 capitalize focus:outline-none focus:border-brand-500"
                            >
                              {["prospect", "proposal", "negotiation", "won", "lost"].map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setPendingDealDelete(d)}
                              aria-label={`Delete ${d.title}`}
                              className="text-slate-600 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            value={dealForm.title}
                            onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="New deal title"
                            className="flex-1 bg-slam-card border border-slam-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                          />
                          <div className="relative">
                            <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                            <input
                              value={dealForm.value}
                              onChange={e => setDealForm(f => ({ ...f, value: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") addDeal(c.id); }}
                              inputMode="decimal"
                              placeholder="0"
                              className="w-28 bg-slam-card border border-slam-border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                            />
                          </div>
                          <button
                            onClick={() => addDeal(c.id)}
                            disabled={addingDeal}
                            className="btn-primary text-xs py-2 px-4 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {addingDeal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Add deal
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
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
              <h2 className="font-bold">{editing ? "Edit Contact" : "Add Contact"}</h2>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} aria-label="Close">
                <X className="w-5 h-5 text-slate-500" />
              </button>
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
                <button onClick={() => { setShowAdd(false); setEditing(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={saveContact} disabled={!form.name.trim() || saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editing ? "Save Changes" : "Add Contact"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete contact?"
        message={`${pendingDelete?.name ?? "This contact"} and any deals attached to them will be permanently removed.`}
        busy={deleting}
        onConfirm={deleteContact}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDealDelete)}
        title="Delete deal?"
        message={`"${pendingDealDelete?.title ?? "This deal"}" will be permanently removed, including from your revenue figures.`}
        busy={deletingDeal}
        onConfirm={deleteDeal}
        onCancel={() => setPendingDealDelete(null)}
      />
    </div>
  );
}
