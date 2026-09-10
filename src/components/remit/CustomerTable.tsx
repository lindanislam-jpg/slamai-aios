"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, SandboxBadge } from "./ui";

export interface AdminCustomer {
  id: string;
  fullName: string;
  email: string;
  status: string;
  kycStatus: string;
  riskScore: number;
  isDemo: boolean;
  countryCode: string;
  transfers: number;
  lifetimeVolume: string;
  createdAt: string;
  suspendedReason: string | null;
}

/**
 * Customer list with suspend/reinstate.
 *
 * Suspension is a sensitive operation: it needs the customers:suspend
 * permission, requires a reason, and is written to the audit log. The control
 * is only rendered for an admin who holds the permission, and the API checks it
 * again regardless.
 */
export function CustomerTable({
  customers: initial,
  canSuspend,
  query,
}: {
  customers: AdminCustomer[];
  canSuspend: boolean;
  query: string;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleSuspension(customer: AdminCustomer) {
    const suspending = customer.status !== "SUSPENDED";
    let reason: string | undefined;

    if (suspending) {
      const entered = window.prompt("Reason for suspending this account (recorded in the audit log):");
      if (!entered?.trim()) return;
      reason = entered.trim();
    }

    setBusy(customer.id);
    setError(null);
    const response = await fetch(`/api/remit/admin/customers/${customer.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: suspending, reason }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(data?.error?.message ?? "That change could not be applied");
      return;
    }
    setCustomers((current) =>
      current.map((row) =>
        row.id === customer.id
          ? { ...row, status: data.status, suspendedReason: suspending ? (reason ?? null) : null }
          : row,
      ),
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="query"
            defaultValue={query}
            placeholder="Name or email"
            className="min-w-[240px] flex-1 rounded-xl border border-send-line px-4 py-2.5 text-[14px]"
          />
          <button
            type="submit"
            className="rounded-xl bg-send-primary px-5 py-2.5 text-[14px] font-bold text-white"
          >
            Search
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="border-b border-send-line">
            <tr className="text-left text-[11px] uppercase tracking-wide text-send-muted">
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">KYC</th>
              <th className="px-4 py-3 text-right font-bold">Risk</th>
              <th className="px-4 py-3 text-right font-bold">Transfers</th>
              <th className="px-4 py-3 text-right font-bold">Lifetime volume</th>
              {canSuspend && <th className="px-4 py-3 font-bold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-send-line">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-send-canvas">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-send-ink">{customer.fullName}</span>
                    {customer.isDemo && <SandboxBadge />}
                  </div>
                  <div className="text-[11px] text-send-muted">
                    {customer.email} · {customer.countryCode} · joined{" "}
                    {new Date(customer.createdAt).toLocaleDateString("en-IE")}
                  </div>
                  {customer.suspendedReason && (
                    <div className="mt-0.5 text-[11px] font-semibold text-send-danger">
                      {customer.suspendedReason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                      customer.status === "ACTIVE"
                        ? "bg-send-primary-soft text-send-primary"
                        : customer.status === "SUSPENDED"
                          ? "bg-send-danger-soft text-send-danger"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {customer.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-send-body">{customer.kycStatus}</td>
                <td className="tnum px-4 py-3 text-right">{customer.riskScore}</td>
                <td className="tnum px-4 py-3 text-right">{customer.transfers}</td>
                <td className="tnum px-4 py-3 text-right font-semibold">
                  {customer.lifetimeVolume}
                </td>
                {canSuspend && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSuspension(customer)}
                      disabled={busy === customer.id}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                        customer.status === "SUSPENDED"
                          ? "text-send-primary hover:bg-send-primary-soft"
                          : "text-send-danger hover:bg-send-danger-soft"
                      }`}
                    >
                      {customer.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={canSuspend ? 7 : 6} className="px-4 py-10 text-center text-send-muted">
                  No customers match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
