"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/dashboard/Header";
import {
  User, Mail, Shield, Sparkles, Check, X, Bot, Users, FileText,
  Kanban, LogOut, Loader2, CreditCard, Database, Brain,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import toast from "react-hot-toast";

interface SettingsData {
  user: { id: string; name: string | null; email: string; role: string; plan: string; createdAt: string };
  usage: { agents: number; contacts: number; documents: number; projects: number };
  integrations: { openai: boolean; stripe: boolean; database: boolean };
}

const integrationMeta = [
  { key: "openai",   label: "OpenAI",   icon: Brain,      hint: "Powers agents, marketing copy and document analysis", env: "OPENAI_API_KEY" },
  { key: "stripe",   label: "Stripe",   icon: CreditCard, hint: "Billing and subscription management",                 env: "STRIPE_SECRET_KEY" },
  { key: "database", label: "Database", icon: Database,   hint: "Postgres store for all workspace data",               env: "DATABASE_URL" },
] as const;

export default function SettingsPage() {
  const { update } = useSession();
  const [data, setData]   = useState<SettingsData | null>(null);
  const [name, setName]   = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get<SettingsData>("/api/settings")
      .then(r => { setData(r.data); setName(r.data.user.name ?? ""); })
      .catch(() => toast.error("Could not load settings"));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name cannot be empty");
    setSaving(true);
    try {
      const r = await axios.patch("/api/settings", { name: name.trim() });
      setData(d => (d ? { ...d, user: { ...d.user, name: r.data.name } } : d));
      await update({ name: r.data.name });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  const usageItems = [
    { label: "AI Agents", value: data?.usage.agents,    icon: Bot,      color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Contacts",  value: data?.usage.contacts,  icon: Users,    color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { label: "Documents", value: data?.usage.documents, icon: FileText, color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Projects",  value: data?.usage.projects,  icon: Kanban,   color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">

        {/* Profile */}
        <section className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" /> Profile
          </h3>
          <p className="text-sm text-slate-500 mb-5">How your name appears across the workspace.</p>

          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm text-slate-400 mb-1.5">Display name</label>
              <input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!data}
                maxLength={100}
                className="input-field disabled:opacity-50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <div className="flex items-center gap-2 bg-slam-dark border border-slam-border rounded-lg px-4 py-3 text-slate-400">
                <Mail className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <span className="truncate">{data?.user.email ?? "—"}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">Your email is used to sign in and cannot be changed here.</p>
            </div>

            <button type="submit" disabled={saving || !data} className="btn-primary disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        {/* Account */}
        <section className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-400" /> Account
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-slate-500 mb-1">Plan</dt>
              <dd className="flex items-center gap-1.5 font-medium capitalize">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                {data?.user.plan ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 mb-1">Role</dt>
              <dd className="font-medium capitalize">{data?.user.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 mb-1">Member since</dt>
              <dd className="font-medium">{data ? formatDate(data.user.createdAt) : "—"}</dd>
            </div>
          </dl>
        </section>

        {/* Usage */}
        <section className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-5">Workspace usage</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {usageItems.map(u => (
              <div key={u.label} className="bg-slam-dark border border-slam-border rounded-xl p-4">
                <div className={`w-9 h-9 rounded-lg ${u.bg} flex items-center justify-center mb-3`}>
                  <u.icon className={`w-4 h-4 ${u.color}`} />
                </div>
                <div className="text-xl font-bold text-slate-100">{u.value ?? "—"}</div>
                <div className="text-sm text-slate-500">{u.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-1">Integrations</h3>
          <p className="text-sm text-slate-500 mb-5">
            Configured through environment variables on the server. Keys are never sent to the browser.
          </p>
          <div className="space-y-3">
            {integrationMeta.map(i => {
              const on = data?.integrations[i.key];
              return (
                <div key={i.key} className="flex items-center gap-3 bg-slam-dark border border-slam-border rounded-xl p-4">
                  <div className="w-9 h-9 rounded-lg bg-slam-card border border-slam-border flex items-center justify-center flex-shrink-0">
                    <i.icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-200">{i.label}</div>
                    <div className="text-xs text-slate-500 truncate">{i.hint}</div>
                  </div>
                  {data && (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 flex-shrink-0 ${
                        on
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}
                      title={on ? `${i.env} is set` : `Set ${i.env} to enable`}
                    >
                      {on ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {on ? "Connected" : "Not configured"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Session */}
        <section className="glass rounded-2xl p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold mb-1">Session</h3>
            <p className="text-sm text-slate-500">Sign out of SlamAI on this device.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-red-400 border border-slam-border hover:border-red-500/40 rounded-lg px-4 py-2.5 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </section>

      </div>
    </div>
  );
}
