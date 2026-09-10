import Link from "next/link";
import { Check, Minus } from "lucide-react";
import MarketingNav from "@/components/voice/MarketingNav";
import MarketingFooter from "@/components/voice/MarketingFooter";
import { PURCHASABLE_PLANS } from "@/lib/voice/plans";

export const metadata = {
  title: "Pricing — SlamAI Voice",
  description: "Simple monthly pricing for an AI receptionist that answers every call.",
};

const COMPARISON: { label: string; get: (planIndex: number) => string | boolean }[] = [
  { label: "Included voice minutes", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.minutes) },
  { label: "AI receptionists", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.agents) },
  { label: "Phone numbers", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.phoneNumbers) },
  { label: "Team seats", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.seats) },
  { label: "Knowledge sources", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.knowledgeSources) },
  { label: "Appointments a month", get: (i) => limitText(PURCHASABLE_PLANS[i].limits.appointments) },
  { label: "Call history kept", get: (i) => retentionText(PURCHASABLE_PLANS[i].limits.retentionDays) },
  { label: "Lead capture and scoring", get: (i) => PURCHASABLE_PLANS[i].features.includes("leads") },
  { label: "Appointment booking", get: (i) => PURCHASABLE_PLANS[i].features.includes("appointments") },
  { label: "Transfer to a person", get: (i) => PURCHASABLE_PLANS[i].features.includes("transfers") },
  { label: "Email and SMS alerts", get: (i) => PURCHASABLE_PLANS[i].features.includes("notifications") },
  { label: "Webhooks and n8n", get: (i) => PURCHASABLE_PLANS[i].features.includes("webhooks") },
  { label: "Calendar sync", get: (i) => PURCHASABLE_PLANS[i].features.includes("calendar") },
  { label: "Full analytics", get: (i) => PURCHASABLE_PLANS[i].features.includes("analytics") },
  { label: "Activity log", get: (i) => PURCHASABLE_PLANS[i].features.includes("audit_log") },
  { label: "API access", get: (i) => PURCHASABLE_PLANS[i].features.includes("api") },
  {
    label: "Overage per extra minute",
    get: (i) => (PURCHASABLE_PLANS[i].overagePerMinute ? `€${PURCHASABLE_PLANS[i].overagePerMinute}` : "Negotiated"),
  },
];

export default function PricingPage() {
  return (
    <>
      <MarketingNav />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% -20%, rgba(99,102,241,0.22), transparent)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center lg:px-8">
          <h1 className="text-[38px] font-semibold leading-tight tracking-tight text-white sm:text-[46px]">
            One missed job costs more than a month of this
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-400">
            Every plan starts with a 14-day free trial. No card, no setup fee, cancel whenever you like.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-4">
          {PURCHASABLE_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-[#111124]/60 p-6 ${
                plan.popular ? "border-indigo-500/40 shadow-[0_0_60px_-25px_rgba(99,102,241,0.9)]" : "border-white/[0.07]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1 text-[11px] font-medium text-white">
                  Most popular
                </span>
              )}
              <h2 className="text-[18px] font-semibold text-white">{plan.name}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{plan.tagline}</p>
              <div className="mt-4">
                {plan.id === "enterprise" ? (
                  <span className="text-[34px] font-semibold leading-none text-white">Custom</span>
                ) : (
                  <>
                    <span className="text-[34px] font-semibold leading-none text-white">€{plan.price}</span>
                    <span className="text-[14px] text-slate-500">/month</span>
                  </>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-[13.5px] text-slate-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {highlight}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.id === "enterprise" ? "/voice/demo" : "/voice/signup"}
                className={`mt-6 rounded-xl px-4 py-2.5 text-center text-[14px] font-medium transition-all ${
                  plan.popular
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400"
                    : "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <h2 className="text-center text-[28px] font-semibold tracking-tight text-white">Compare every plan</h2>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-white/[0.08] px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                    Feature
                  </th>
                  {PURCHASABLE_PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className="border-b border-white/[0.08] px-4 py-3 text-center text-[13.5px] font-semibold text-white"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="transition-colors hover:bg-white/[0.02]">
                    <td className="border-b border-white/[0.04] px-4 py-3 text-[13.5px] text-slate-300">{row.label}</td>
                    {PURCHASABLE_PLANS.map((plan, index) => {
                      const value = row.get(index);
                      return (
                        <td key={plan.id} className="border-b border-white/[0.04] px-4 py-3 text-center">
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="mx-auto h-4 w-4 text-emerald-400" />
                            ) : (
                              <Minus className="mx-auto h-4 w-4 text-slate-700" />
                            )
                          ) : (
                            <span className="text-[13.5px] text-slate-300">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-6">
            <h3 className="text-[15px] font-semibold text-white">About voice minutes</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">
              A voice minute is a minute your AI spends on a live call, rounded up per call. Each plan includes a
              monthly allowance; anything beyond it is billed at that plan&apos;s overage rate, shown above. You can see
              exactly where you are at any time in your dashboard, and we warn you before you get close.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
              All prices exclude VAT. Phone number rental is charged by your telephony provider and is not included.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}

function limitText(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString();
}

function retentionText(days: number | null): string {
  if (days === null) return "Unlimited";
  if (days >= 365) return `${Math.round(days / 365)} year${days >= 730 ? "s" : ""}`;
  return `${days} days`;
}
