import Link from "next/link";
import type { Metadata } from "next";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import {
  getCorridorPerformance,
  getKpis,
  getProviderPerformance,
  getTimeseries,
} from "@/remit/server/analytics-service";
import { providerStatuses } from "@/remit/providers/registry";
import { RevenueChart, TransfersChart, VolumeChart } from "@/components/remit/AdminCharts";
import { Card, PageHeader, SandboxBadge } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin overview" };

export default async function SendAdminOverviewPage() {
  await requireAdmin(PERMISSIONS.VIEW_TRANSFERS);

  const [kpis, timeseries, corridors, providers] = await Promise.all([
    getKpis(),
    getTimeseries(30),
    getCorridorPerformance(),
    getProviderPerformance(),
  ]);

  const integrations = providerStatuses();
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Volume, revenue and margin across the platform. Last 30 days for the charts."
      />

      {/* --- Headline KPIs ------------------------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total transfers" value={String(kpis.totalTransfers)} sub={`${kpis.completedTransfers} completed`} />
        <Kpi label="Transaction volume" value={kpis.totalVolume.formatted} sub="Completed transfers only" />
        <Kpi label="Fee revenue" value={kpis.feeRevenue.formatted} sub="Gross, before provider costs" tone="accent" />
        <Kpi
          label="Gross margin"
          value={kpis.grossMargin.formatted}
          sub={`${percent(kpis.grossMarginPercent)} of gross revenue`}
          tone={Number(kpis.grossMargin.amount) < 0 ? "danger" : "primary"}
        />
      </div>

      {/* --- The margin truth --------------------------------------------- */}
      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Where the money actually goes</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-send-body">
          The transfer fee is revenue, not profit. Collecting the customer&apos;s money and paying
          the recipient both cost us, and those costs are tracked per transfer rather than assumed
          away.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Transfer fees", kpis.feeRevenue.formatted, "text-send-ink"],
            ["FX margin", kpis.fxMarginRevenue.formatted, "text-send-ink"],
            ["Provider costs", `− ${kpis.providerCosts.formatted}`, "text-send-danger"],
            ["Gross margin", kpis.grossMargin.formatted, "text-send-primary"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-send-line px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                {label}
              </dt>
              <dd className={`tnum mt-1 text-[19px] font-black ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {Number(kpis.grossMargin.amount) < 0 && (
          <p className="mt-3 rounded-xl bg-send-danger-soft px-4 py-3 text-[13px] font-semibold text-send-danger">
            Gross margin is negative: provider costs exceed what the fee brings in. The fee, the FX
            margin or the provider mix needs to change before this scales.
          </p>
        )}
      </Card>

      {/* --- Operational KPIs --------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Success rate" value={percent(kpis.successRate)} sub={`${kpis.failedTransfers} failed`} />
        <Kpi
          label="Failed payment rate"
          value={percent(kpis.failureRate)}
          sub="Of settled transfers"
          tone={kpis.failureRate > 0.05 ? "danger" : undefined}
        />
        <Kpi
          label="Average transfer time"
          value={kpis.averageCompletionMinutes === null ? "—" : `${kpis.averageCompletionMinutes} min`}
          sub="Creation to recipient paid"
        />
        <Kpi label="Average transfer" value={kpis.averageTransfer.formatted} sub="Completed transfers" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pending" value={String(kpis.pendingTransfers)} sub="In flight now" />
        <Kpi
          label="Awaiting review"
          value={String(kpis.reviewTransfers)}
          sub={<Link href="/send/admin/reviews" className="font-bold text-send-primary">Open the queue</Link>}
          tone={kpis.reviewTransfers > 0 ? "accent" : undefined}
        />
        <Kpi label="Customers" value={String(kpis.customers)} sub={`${kpis.newCustomers30d} joined in 30 days`} />
        <Kpi
          label="Coverage"
          value={`${kpis.activeCorridors} corridor${kpis.activeCorridors === 1 ? "" : "s"}`}
          sub={`${kpis.currencies} currencies configured`}
        />
      </div>

      {/* --- Charts -------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-[15px] font-bold text-send-ink">Transaction volume</h2>
          <VolumeChart data={timeseries} />
        </Card>
        <Card>
          <h2 className="mb-3 text-[15px] font-bold text-send-ink">Daily fee revenue</h2>
          <RevenueChart data={timeseries} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-send-ink">Transfers per day</h2>
        <TransfersChart data={timeseries} />
      </Card>

      {/* --- Corridors and providers --------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-[15px] font-bold text-send-ink">Corridor performance</h2>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-send-muted">
                <th className="pb-2 font-bold">Route</th>
                <th className="pb-2 text-right font-bold">Transfers</th>
                <th className="pb-2 text-right font-bold">Volume</th>
                <th className="pb-2 text-right font-bold">Success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-send-line">
              {corridors.map((row) => (
                <tr key={row.corridor}>
                  <td className="py-2.5 font-semibold text-send-ink">{row.corridor}</td>
                  <td className="tnum py-2.5 text-right">{row.transfers}</td>
                  <td className="tnum py-2.5 text-right">{row.volume}</td>
                  <td className="tnum py-2.5 text-right">{percent(row.successRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-[15px] font-bold text-send-ink">Provider performance</h2>
          {providers.length === 0 ? (
            <p className="mt-3 text-[13px] text-send-muted">No provider activity yet.</p>
          ) : (
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-send-muted">
                  <th className="pb-2 font-bold">Provider</th>
                  <th className="pb-2 font-bold">Leg</th>
                  <th className="pb-2 text-right font-bold">Calls</th>
                  <th className="pb-2 text-right font-bold">Success</th>
                  <th className="pb-2 text-right font-bold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-send-line">
                {providers.map((row) => (
                  <tr key={`${row.kind}:${row.provider}`}>
                    <td className="py-2.5 font-semibold text-send-ink">{row.provider}</td>
                    <td className="py-2.5 capitalize text-send-body">{row.kind}</td>
                    <td className="tnum py-2.5 text-right">{row.total}</td>
                    <td className="tnum py-2.5 text-right">{percent(row.successRate)}</td>
                    <td className="tnum py-2.5 text-right">{row.costs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* --- Integration status --------------------------------------------- */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-send-ink">Provider integrations</h2>
          <SandboxBadge />
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-send-body">
          Nothing here is connected to a regulated institution yet. Until one is, no real money can
          move and every figure on this dashboard comes from sandbox activity.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <li
              key={integration.kind}
              className="flex items-center justify-between gap-3 rounded-xl border border-send-line px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-send-ink">{integration.kind}</div>
                <div className="truncate text-[12px] text-send-muted">
                  {integration.displayName}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  integration.isLive
                    ? "bg-send-primary-soft text-send-primary"
                    : "bg-send-accent-soft text-send-warning"
                }`}
              >
                {integration.statusLabel}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "primary" | "accent" | "danger";
}) {
  return (
    <div className="send-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-send-muted">{label}</div>
      <div
        className={`tnum mt-1 text-[24px] font-black leading-none ${
          tone === "accent"
            ? "text-send-warning"
            : tone === "danger"
              ? "text-send-danger"
              : tone === "primary"
                ? "text-send-primary"
                : "text-send-ink"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-send-muted">{sub}</div>}
    </div>
  );
}
