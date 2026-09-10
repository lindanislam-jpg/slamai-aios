"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, CreditCard, ExternalLink, Gauge } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader,
} from "@/components/voice/ui";
import type { VoicePlan } from "@/lib/voice/plans";
import { METRIC_LABELS, type Metric } from "@/lib/voice/metrics";

type BillingData = {
  subscription: {
    planId: string; status: string; currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean; trialEndsAt: string | null;
  } | null;
  plan: VoicePlan;
  usage: {
    period: string; totals: Record<string, number>; minutesIncluded: number | null;
    minutesUsed: number; minutesPercent: number | null; overageMinutes: number;
    estimatedOverageCost: number;
  };
  plans: (VoicePlan & { purchasable: boolean })[];
  stripeConfigured: boolean;
};

export default function BillingPage() {
  const { data, loading, error, refresh } = useApi<BillingData>("/api/v1/billing");
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <Loading label="Loading your plan…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  async function checkout(planId: string) {
    setBusy(planId);
    try {
      const result = await api<{ url: string }>("/api/v1/billing/checkout", "POST", { planId });
      window.location.href = result.url;
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const result = await api<{ url: string }>("/api/v1/billing/portal", "POST");
      window.location.href = result.url;
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  }

  const { subscription, plan, usage } = data;
  const onTrial = subscription?.status === "trialing";

  return (
    <>
      <PageHeader
        title="Plan and usage"
        description="What you're on, what you've used, and what it would cost to move."
        action={
          subscription?.planId !== "trial" ? (
            <Button
              variant="secondary"
              loading={busy === "portal"}
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={openPortal}
            >
              Manage billing
            </Button>
          ) : null
        }
      />

      {!data.stripeConfigured && (
        <Card className="mb-4 border-amber-500/25 bg-amber-500/[0.06] p-4 text-[13px] text-amber-200">
          Billing isn&apos;t connected on this deployment yet. Add your Stripe keys to take payments — see
          <span className="font-mono"> docs/STRIPE_SETUP.md</span>.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                <Badge
                  tone={
                    subscription?.status === "active" ? "success"
                    : subscription?.status === "past_due" ? "danger"
                    : subscription?.status === "trialing" ? "brand" : "neutral"
                  }
                >
                  {subscription?.status ?? "trialing"}
                </Badge>
              </div>
              <p className="mt-1 text-[13px] text-slate-400">{plan.tagline}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-white">
                {plan.price > 0 ? `€${plan.price}` : "Free"}
                {plan.price > 0 && <span className="text-[13px] font-normal text-slate-500">/month</span>}
              </div>
              {subscription?.currentPeriodEnd && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                </p>
              )}
            </div>
          </div>

          {onTrial && subscription?.trialEndsAt && (
            <div className="mt-4 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.08] px-4 py-3 text-[13px] text-indigo-200">
              Your free trial runs until{" "}
              {new Date(subscription.trialEndsAt).toLocaleDateString("en-GB", { dateStyle: "long" })}. Pick a plan
              before then and your AI keeps answering without a break.
            </div>
          )}

          {subscription?.status === "past_due" && (
            <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3 text-[13px] text-rose-200">
              Your last payment failed. Update your card to keep your AI answering.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Gauge className="h-3.5 w-3.5" /> Minutes this month
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[28px] font-semibold leading-none text-white">{Math.round(usage.minutesUsed)}</span>
            <span className="pb-0.5 text-[13px] text-slate-400">of {usage.minutesIncluded ?? "unlimited"}</span>
          </div>
          {usage.minutesPercent !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${
                  usage.minutesPercent > 90 ? "bg-rose-500" : usage.minutesPercent > 75 ? "bg-amber-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.min(100, usage.minutesPercent)}%` }}
              />
            </div>
          )}
          {usage.overageMinutes > 0 && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-amber-300">
              {Math.round(usage.overageMinutes)} minutes over your plan. At €{plan.overagePerMinute ?? 0} a minute
              that&apos;s about €{usage.estimatedOverageCost.toFixed(2)} — an estimate, billed on your next invoice.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Everything you've used this month" description={usage.period} />
        <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((metric) => (
            <div key={metric} className="bg-[#15152b] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                {METRIC_LABELS[metric]}
              </div>
              <div className="mt-1.5 text-xl font-semibold text-white">
                {Math.round(usage.totals[metric] ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mb-4 mt-8 text-lg font-semibold text-white">Plans</h2>
      <div className="grid gap-4 lg:grid-cols-4">
        {data.plans
          .filter((p) => p.id !== "trial")
          .map((p) => {
            const current = p.id === subscription?.planId;
            return (
              <Card
                key={p.id}
                className={`relative flex flex-col p-5 ${p.popular ? "border-indigo-500/40 shadow-[0_0_40px_-20px_rgba(99,102,241,0.8)]" : ""}`}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-base font-semibold text-white">{p.name}</h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-400">{p.tagline}</p>
                <div className="mt-3">
                  {p.id === "enterprise" ? (
                    <span className="text-2xl font-semibold text-white">Custom</span>
                  ) : (
                    <>
                      <span className="text-2xl font-semibold text-white">€{p.price}</span>
                      <span className="text-[13px] text-slate-500">/month</span>
                    </>
                  )}
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-[13px] text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={current ? "secondary" : p.popular ? "primary" : "secondary"}
                  disabled={current || !p.purchasable}
                  loading={busy === p.id}
                  icon={current ? undefined : <CreditCard className="h-4 w-4" />}
                  onClick={() => checkout(p.id)}
                >
                  {current ? "Your plan" : !p.purchasable ? "Contact us" : `Move to ${p.name}`}
                </Button>
                {!p.purchasable && p.id !== "enterprise" && (
                  <p className="mt-2 text-center text-[11.5px] text-slate-500">No Stripe price configured yet.</p>
                )}
              </Card>
            );
          })}
      </div>

      <p className="mt-6 text-center text-[12.5px] text-slate-500">
        All prices exclude VAT. Voice minutes above your plan are billed at the overage rate shown on your plan.
      </p>
    </>
  );
}
