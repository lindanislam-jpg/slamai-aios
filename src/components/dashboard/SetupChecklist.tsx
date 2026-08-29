"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, X, PhoneCall, PartyPopper } from "lucide-react";
import { useResource, mutate } from "@/lib/useApi";

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  optional?: boolean;
}

interface Onboarding {
  steps: Step[];
  completed: number;
  total: number;
  allDone: boolean;
  dismissed: boolean;
}

/**
 * The path from "signed up" to "my phone is being answered". Shown until the
 * required steps are done, or until the user dismisses it.
 */
export default function SetupChecklist() {
  const { data, loading, refresh } = useResource<Onboarding>("/api/onboarding");
  const [hidden, setHidden] = useState(false);

  async function dismiss() {
    setHidden(true);
    try {
      await mutate("/api/onboarding", "PATCH", { dismissed: true });
      await refresh();
    } catch {
      // Not worth interrupting them over — it reappears on the next load.
      setHidden(false);
    }
  }

  if (loading || !data || data.dismissed || hidden) return null;

  const pct = data.total ? Math.round((data.completed / data.total) * 100) : 0;
  const nextStep = data.steps.find((s) => !s.done && !s.optional);

  // Everything required is done — congratulate once, then let them clear it.
  if (data.allDone) {
    return (
      <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
          <PartyPopper className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-semibold text-slate-100">You&apos;re set up</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Your agent is live and answering. Every call from here lands in your CRM on its own.
          </p>
        </div>
        <button onClick={dismiss} className="btn-secondary text-sm py-2 px-5 flex-shrink-0">
          Got it
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
            <PhoneCall className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Get your phone answered</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {nextStep
                ? `Next: ${nextStep.title.toLowerCase()}.`
                : "Nearly there."}
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          title="Hide this"
          className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-slam-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
          {data.completed} of {data.total}
        </span>
      </div>

      {/* Steps */}
      <ol className="space-y-1">
        {data.steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
              step.done ? "opacity-55" : "hover:bg-slam-dark/50"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                step.done
                  ? "bg-brand-600 border-brand-600"
                  : "border-slam-border"
              }`}
            >
              {step.done && <Check className="w-3 h-3 text-white" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${step.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                {step.title}
                {step.optional && !step.done && (
                  <span className="ml-2 text-xs text-slate-600 font-normal">optional</span>
                )}
              </div>
              {!step.done && (
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              )}
            </div>

            {!step.done && (
              <Link
                href={step.href}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1 flex-shrink-0"
              >
                {step.cta} <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
