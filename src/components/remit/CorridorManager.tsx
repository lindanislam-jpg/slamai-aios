"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, SandboxBadge, inputClass } from "./ui";

export interface CorridorRow {
  id: string;
  label: string;
  pair: string;
  isActive: boolean;
  isLive: boolean;
  fxMarginBps: number;
  minAmount: string;
  maxAmount: string;
  dailyLimit: string;
  monthlyLimit: string;
  destRiskBand: string;
  fxProviderKey: string;
  payoutProviderKey: string;
  paymentMethods: string[];
  payoutMethods: string[];
}

/**
 * Corridor settings: limits, FX margin and availability.
 *
 * The FX margin is editable here because it is a pricing decision, but the
 * quote always discloses it to the customer as a separate line — raising it is
 * a business choice, never a way to hide a charge.
 */
export function CorridorManager({ corridors }: { corridors: CorridorRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<CorridorRow>>({});

  async function save(corridor: CorridorRow) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/remit/admin/corridors/${corridor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isActive: draft.isActive ?? corridor.isActive,
        fxMarginBps: Number(draft.fxMarginBps ?? corridor.fxMarginBps),
        minAmount: draft.minAmount ?? corridor.minAmount,
        maxAmount: draft.maxAmount ?? corridor.maxAmount,
        dailyLimit: draft.dailyLimit ?? corridor.dailyLimit,
        monthlyLimit: draft.monthlyLimit ?? corridor.monthlyLimit,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data?.error?.message ?? "Those settings could not be saved");
      return;
    }
    setEditing(null);
    setDraft({});
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {corridors.map((corridor) => {
        const open = editing === corridor.id;
        return (
          <Card key={corridor.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-bold text-send-ink">{corridor.label}</h2>
                <div className="mt-0.5 text-[13px] text-send-body">
                  {corridor.pair} · destination risk band {corridor.destRiskBand}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!corridor.isLive && <SandboxBadge />}
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                    corridor.isActive
                      ? "bg-send-primary-soft text-send-primary"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {corridor.isActive ? "Open" : "Closed"}
                </span>
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Min", `€${corridor.minAmount}`],
                ["Max", `€${corridor.maxAmount}`],
                ["24h limit", `€${corridor.dailyLimit}`],
                ["30d limit", `€${corridor.monthlyLimit}`],
                ["FX margin", `${(corridor.fxMarginBps / 100).toFixed(2)}%`],
                ["Providers", `${corridor.fxProviderKey} / ${corridor.payoutProviderKey}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-send-line px-3.5 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                    {label}
                  </dt>
                  <dd className="tnum mt-0.5 truncate text-[14px] font-bold text-send-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2 text-[12px]">
              {corridor.paymentMethods.map((method) => (
                <span key={method} className="rounded-lg bg-send-canvas px-2.5 py-1 font-semibold text-send-body">
                  pay-in: {method.replace(/_/g, " ").toLowerCase()}
                </span>
              ))}
              {corridor.payoutMethods.map((method) => (
                <span key={method} className="rounded-lg bg-send-canvas px-2.5 py-1 font-semibold text-send-body">
                  payout: {method.replace(/_/g, " ").toLowerCase()}
                </span>
              ))}
            </div>

            {open ? (
              <div className="space-y-4 rounded-xl border border-send-line p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ["minAmount", "Minimum (EUR)"],
                      ["maxAmount", "Maximum (EUR)"],
                      ["dailyLimit", "24-hour limit (EUR)"],
                      ["monthlyLimit", "30-day limit (EUR)"],
                      ["fxMarginBps", "FX margin (basis points)"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label} htmlFor={`${corridor.id}-${key}`}>
                      <input
                        id={`${corridor.id}-${key}`}
                        inputMode="decimal"
                        value={String(draft[key] ?? corridor[key])}
                        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>

                <label className="flex items-center gap-3 text-[14px] font-semibold text-send-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.isActive ?? corridor.isActive)}
                    onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                    className="h-5 w-5 accent-send-primary"
                  />
                  Corridor open to customers
                </label>

                <div className="flex gap-2">
                  <Button onClick={() => save(corridor)} disabled={busy}>
                    {busy ? "Saving…" : "Save settings"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(null);
                      setDraft({});
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(corridor.id);
                  setDraft({});
                }}
              >
                Edit settings
              </Button>
            )}
          </Card>
        );
      })}

      <Alert tone="info" title="Adding a corridor">
        A new route needs a country row, a currency row, a corridor row with its limits and
        providers, and a recipient field schema for the destination payout method. No application
        code changes.
      </Alert>
    </div>
  );
}
