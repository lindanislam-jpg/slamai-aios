"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/dashboard/Header";
import {
  User, Building2, Lock, CreditCard, Loader2, Check, Save, ExternalLink, Sparkles, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState } from "@/components/dashboard/States";
import { MIN_PASSWORD_LENGTH, formatDate } from "@/lib/utils";
import { PLANS, type Plan } from "@/lib/plans";

interface Profile {
  id: string; name: string | null; email: string; company: string | null;
  role: string; plan: string; stripeStatus: string | null; planRenewsAt: string | null;
  hasBillingAccount: boolean; createdAt: string; planDetails: Plan;
}

function SettingsContent() {
  const { update: updateSession } = useSession();
  const params = useSearchParams();
  const { data: profile, loading, error, refresh } = useResource<Profile>("/api/settings/profile");

  const [form, setForm]           = useState({ name: "", company: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw]               = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw]   = useState(false);

  const [billingBusy, setBillingBusy] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm({ name: profile.name || "", company: profile.company || "" });
  }, [profile]);

  // Surface the outcome of a Stripe redirect once, on arrival.
  useEffect(() => {
    const checkout = params.get("checkout");
    if (checkout === "success") toast.success("Subscription active — welcome aboard!");
    if (checkout === "cancelled") toast("Checkout cancelled — no charge was made.");
  }, [params]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await mutate("/api/settings/profile", "PATCH", form);
      await refresh();
      await updateSession();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (pw.next !== pw.confirm) { toast.error("The new passwords don't match"); return; }
    if (pw.next.length < MIN_PASSWORD_LENGTH) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setSavingPw(true);
    try {
      await mutate("/api/settings/password", "POST", { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change your password");
    } finally {
      setSavingPw(false);
    }
  }

  async function startCheckout(planId: string) {
    setBillingBusy(planId);
    try {
      const { url } = await mutate<{ url: string }>("/api/stripe/checkout", "POST", { plan: planId });
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
      setBillingBusy(null);
    }
  }

  async function openPortal() {
    setBillingBusy("portal");
    try {
      const { url } = await mutate<{ url: string }>("/api/stripe/portal", "POST");
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the billing portal");
      setBillingBusy(null);
    }
  }

  const currentPlan = profile ? PLANS.find((p) => p.id === profile.plan) || PLANS[0] : null;

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">

        {loading ? (
          <LoadingState label="Loading your settings…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !profile ? null : (
          <>
            {/* Profile */}
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Profile</h3>
                  <p className="text-xs text-slate-500">Your name and company across the platform.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="input-field pl-10"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Company</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={form.company}
                      onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                      className="input-field pl-10"
                      placeholder="Your company"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email</label>
                  <input value={profile.email} disabled className="input-field opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-slate-600 mt-1.5">Your email is your sign-in and can&apos;t be changed here.</p>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save changes
                </button>
              </div>
            </section>

            {/* Billing */}
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Plan &amp; billing</h3>
                  <p className="text-xs text-slate-500">Manage your subscription.</p>
                </div>
              </div>

              <div className="bg-slam-dark rounded-xl border border-slam-border p-5 mb-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-400" />
                      <span className="font-bold text-lg">{currentPlan?.name}</span>
                      {profile.stripeStatus && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          profile.stripeStatus === "active" || profile.stripeStatus === "trialing"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {profile.stripeStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {currentPlan && currentPlan.price > 0 ? `€${currentPlan.price}/month` : "No charge"}
                      {profile.planRenewsAt && ` · renews ${formatDate(profile.planRenewsAt)}`}
                    </p>
                  </div>
                  {profile.hasBillingAccount && (
                    <button
                      onClick={openPortal}
                      disabled={billingBusy === "portal"}
                      className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40"
                    >
                      {billingBusy === "portal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      Manage subscription
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLANS.filter((p) => p.id !== "free").map((plan) => {
                  const isCurrent = plan.id === profile.plan;
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-xl border-2 p-4 transition-all ${
                        isCurrent ? "border-brand-500 bg-brand-500/5" : "border-slam-border bg-slam-dark"
                      }`}
                    >
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="font-semibold">{plan.name}</span>
                        <span className="text-sm text-slate-400">€{plan.price.toLocaleString()}/mo</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{plan.tagline}</p>
                      <button
                        onClick={() => startCheckout(plan.id)}
                        disabled={isCurrent || billingBusy === plan.id}
                        className={`w-full text-sm py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                          isCurrent
                            ? "bg-slam-card text-slate-500 cursor-default"
                            : "btn-primary disabled:opacity-40"
                        }`}
                      >
                        {isCurrent ? <><Check className="w-3.5 h-3.5" />Current plan</>
                          : billingBusy === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : "Upgrade"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-600 mt-4">
                Payments are handled by Stripe. Card details never touch this platform.
              </p>
            </section>

            {/* Password */}
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Password</h3>
                  <p className="text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-md">
                {[
                  { label: "Current password", key: "current" as const, ph: "Your current password" },
                  { label: "New password",     key: "next"    as const, ph: `At least ${MIN_PASSWORD_LENGTH} characters` },
                  { label: "Confirm new password", key: "confirm" as const, ph: "Repeat the new password" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">{f.label}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={pw[f.key]}
                        onChange={(e) => setPw((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph}
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={changePassword}
                  disabled={!pw.current || !pw.next || !pw.confirm || savingPw}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40"
                >
                  {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Change password
                </button>
              </div>
            </section>

            {/* Account meta */}
            <section className="glass rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Account</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Role</div>
                  <div className="capitalize">{profile.role}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Member since</div>
                  <div>{formatDate(profile.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Account ID</div>
                  <div className="font-mono text-xs text-slate-400 truncate">{profile.id}</div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-full">
        <Header title="Settings" />
        <LoadingState label="Loading your settings…" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
