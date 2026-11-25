"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, inputClass } from "./ui";

export interface FeeRuleRow {
  id: string;
  name: string;
  corridor: string;
  corridorId: string | null;
  segment: string | null;
  promoCode: string | null;
  fixedFee: string;
  percentageBps: number;
  minAmount: string | null;
  maxAmount: string | null;
  priority: number;
  isActive: boolean;
}

export interface CorridorOption {
  id: string;
  label: string;
}

/**
 * Fee configuration.
 *
 * The headline fee is a row here. Changing it changes every future quote with
 * no deploy. Rules are never deleted — a past quote references the rule that
 * priced it — so the only lifecycle operation is enable/disable.
 */
export function FeeManager({
  rules: initial,
  corridors,
}: {
  rules: FeeRuleRow[];
  corridors: CorridorOption[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    corridorId: "",
    promoCode: "",
    segment: "",
    fixedFee: "5.00",
    percentageBps: "0",
    minAmount: "",
    maxAmount: "",
    priority: "10",
  });

  async function toggle(rule: FeeRuleRow) {
    setError(null);
    const response = await fetch(`/api/remit/admin/fees/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error?.message ?? "That change could not be applied");
      return;
    }
    setRules((current) =>
      current.map((row) => (row.id === rule.id ? { ...row, isActive: data.isActive } : row)),
    );
    router.refresh();
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/remit/admin/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        corridorId: form.corridorId || null,
        promoCode: form.promoCode || null,
        segment: form.segment || null,
        currency: "EUR",
        fixedFee: form.fixedFee,
        percentageBps: Number(form.percentageBps),
        minAmount: form.minAmount || null,
        maxAmount: form.maxAmount || null,
        priority: Number(form.priority),
        isActive: true,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data?.error?.message ?? "That rule could not be created");
      return;
    }
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Alert tone="info" title="How a fee is chosen">
        Exactly one rule applies to a quote: the highest priority that matches, then the most
        specific. Fees are never stacked, so the number the customer sees is always the whole
        charge. A promo rule only applies when its code is supplied.
      </Alert>

      {!creating ? (
        <Button onClick={() => setCreating(true)}>+ New fee rule</Button>
      ) : (
        <Card>
          <h2 className="text-[15px] font-bold text-send-ink">New fee rule</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="fee-name">
              <input
                id="fee-name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
                placeholder="Business pricing"
              />
            </Field>
            <Field label="Corridor" htmlFor="fee-corridor" hint="Leave blank for all corridors.">
              <select
                id="fee-corridor"
                value={form.corridorId}
                onChange={(event) => setForm({ ...form, corridorId: event.target.value })}
                className={inputClass}
              >
                <option value="">All corridors</option>
                {corridors.map((corridor) => (
                  <option key={corridor.id} value={corridor.id}>
                    {corridor.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fixed fee (EUR)" htmlFor="fee-fixed">
              <input
                id="fee-fixed"
                required
                inputMode="decimal"
                value={form.fixedFee}
                onChange={(event) => setForm({ ...form, fixedFee: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field
              label="Percentage (basis points)"
              htmlFor="fee-bps"
              hint="50 bps = 0.5% of the send amount, on top of the fixed fee."
            >
              <input
                id="fee-bps"
                inputMode="numeric"
                value={form.percentageBps}
                onChange={(event) => setForm({ ...form, percentageBps: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Minimum amount (EUR)" htmlFor="fee-min" hint="Optional band.">
              <input
                id="fee-min"
                inputMode="decimal"
                value={form.minAmount}
                onChange={(event) => setForm({ ...form, minAmount: event.target.value })}
                className={inputClass}
                placeholder="e.g. 2000"
              />
            </Field>
            <Field label="Maximum amount (EUR)" htmlFor="fee-max" hint="Optional band.">
              <input
                id="fee-max"
                inputMode="decimal"
                value={form.maxAmount}
                onChange={(event) => setForm({ ...form, maxAmount: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Promo code" htmlFor="fee-promo" hint="Only applies when supplied.">
              <input
                id="fee-promo"
                value={form.promoCode}
                onChange={(event) => setForm({ ...form, promoCode: event.target.value })}
                className={inputClass}
                placeholder="FIRSTFREE"
              />
            </Field>
            <Field label="Priority" htmlFor="fee-priority" hint="Higher wins.">
              <input
                id="fee-priority"
                inputMode="numeric"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                className={inputClass}
              />
            </Field>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create rule"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="border-b border-send-line">
            <tr className="text-left text-[11px] uppercase tracking-wide text-send-muted">
              <th className="px-4 py-3 font-bold">Rule</th>
              <th className="px-4 py-3 font-bold">Applies to</th>
              <th className="px-4 py-3 text-right font-bold">Fixed</th>
              <th className="px-4 py-3 text-right font-bold">Variable</th>
              <th className="px-4 py-3 text-right font-bold">Priority</th>
              <th className="px-4 py-3 font-bold">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-send-line">
            {rules.map((rule) => (
              <tr key={rule.id} className={rule.isActive ? "" : "opacity-55"}>
                <td className="px-4 py-3">
                  <div className="font-bold text-send-ink">{rule.name}</div>
                  {rule.promoCode && (
                    <div className="text-[11px] font-bold uppercase text-send-warning">
                      code {rule.promoCode}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-send-body">
                  {rule.corridor}
                  {(rule.minAmount || rule.maxAmount) && (
                    <div className="text-[11px] text-send-muted">
                      {rule.minAmount ?? "any"} – {rule.maxAmount ?? "any"}
                    </div>
                  )}
                </td>
                <td className="tnum px-4 py-3 text-right font-bold">{rule.fixedFee}</td>
                <td className="tnum px-4 py-3 text-right">
                  {rule.percentageBps === 0 ? "—" : `${(rule.percentageBps / 100).toFixed(2)}%`}
                </td>
                <td className="tnum px-4 py-3 text-right">{rule.priority}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(rule)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                      rule.isActive
                        ? "bg-send-primary-soft text-send-primary"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
