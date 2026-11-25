import "server-only";
import { db } from "@/lib/db";
import { Money } from "../money/money";
import { fxMarginRevenue } from "../fx/pricing";
import type { MoneyDTO } from "../money/money";

/**
 * Business analytics.
 *
 * The single most important thing this module gets right: the €5 fee is
 * REVENUE, not profit. Provider costs (collecting the money, delivering the
 * money) are tracked separately on each transfer and subtracted here, so the
 * dashboard shows real gross margin rather than a flattering number.
 */

const REPORTING_CURRENCY = "EUR";

export interface KpiSet {
  totalTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  pendingTransfers: number;
  reviewTransfers: number;
  cancelledTransfers: number;
  successRate: number;
  failureRate: number;
  totalVolume: MoneyDTO;
  averageTransfer: MoneyDTO;
  feeRevenue: MoneyDTO;
  fxMarginRevenue: MoneyDTO;
  grossRevenue: MoneyDTO;
  providerCosts: MoneyDTO;
  grossMargin: MoneyDTO;
  grossMarginPercent: number;
  averageCompletionMinutes: number | null;
  customers: number;
  newCustomers30d: number;
  activeCorridors: number;
  currencies: number;
}

export interface TimeseriesPoint {
  date: string;
  transfers: number;
  volume: string;
  revenue: string;
}

export interface CorridorPerformance {
  corridor: string;
  transfers: number;
  volume: string;
  successRate: number;
}

export interface ProviderPerformance {
  provider: string;
  kind: "payment" | "payout";
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  costs: string;
}

export async function getKpis(): Promise<KpiSet> {
  const [transfers, customers, newCustomers, corridors, currencies] = await Promise.all([
    db.remitTransfer.findMany({
      select: {
        status: true,
        complianceStatus: true,
        sourceAmountMinor: true,
        feeMinor: true,
        sourceCurrency: true,
        fxMarginBps: true,
        providerCostMinor: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.remitCustomer.count(),
    db.remitCustomer.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    db.remitCorridor.count({ where: { isActive: true } }),
    db.remitCurrency.count(),
  ]);

  let volume = Money.zero(REPORTING_CURRENCY);
  let fees = Money.zero(REPORTING_CURRENCY);
  let margin = Money.zero(REPORTING_CURRENCY);
  let costs = Money.zero(REPORTING_CURRENCY);
  let completionMinutes = 0;
  let completedCount = 0;

  const counts = { COMPLETED: 0, FAILED: 0, CANCELLED: 0, PENDING: 0, REVIEW: 0 };

  for (const transfer of transfers) {
    // Only EUR-denominated transfers roll into the reporting totals. A second
    // sending currency needs a reporting-rate conversion here rather than a
    // silent mix of currencies — flagged deliberately instead of guessed at.
    if (transfer.sourceCurrency !== REPORTING_CURRENCY) continue;

    const amount = Money.fromMinor(transfer.sourceAmountMinor, REPORTING_CURRENCY);
    const fee = Money.fromMinor(transfer.feeMinor, REPORTING_CURRENCY);

    if (transfer.status === "COMPLETED") {
      counts.COMPLETED += 1;
      // Only completed transfers count as revenue — a failed transfer's fee is
      // returned with the money.
      volume = volume.add(amount);
      fees = fees.add(fee);
      margin = margin.add(fxMarginRevenue(amount, transfer.fxMarginBps));
      costs = costs.add(Money.fromMinor(transfer.providerCostMinor, REPORTING_CURRENCY));
      if (transfer.completedAt) {
        completionMinutes +=
          (transfer.completedAt.getTime() - transfer.createdAt.getTime()) / 60_000;
        completedCount += 1;
      }
    } else if (transfer.status === "FAILED") {
      counts.FAILED += 1;
      // Costs already incurred on a failed transfer are still real costs.
      costs = costs.add(Money.fromMinor(transfer.providerCostMinor, REPORTING_CURRENCY));
    } else if (transfer.status === "CANCELLED") {
      counts.CANCELLED += 1;
    } else if (transfer.status === "COMPLIANCE_REVIEW") {
      counts.REVIEW += 1;
    } else {
      counts.PENDING += 1;
    }
  }

  const total = transfers.length;
  const settled = counts.COMPLETED + counts.FAILED;
  const grossRevenue = fees.add(margin);
  const grossMargin = grossRevenue.subtract(costs);

  return {
    totalTransfers: total,
    completedTransfers: counts.COMPLETED,
    failedTransfers: counts.FAILED,
    pendingTransfers: counts.PENDING,
    reviewTransfers: counts.REVIEW,
    cancelledTransfers: counts.CANCELLED,
    successRate: settled === 0 ? 0 : round(counts.COMPLETED / settled),
    failureRate: settled === 0 ? 0 : round(counts.FAILED / settled),
    totalVolume: volume.toJSON(),
    averageTransfer:
      counts.COMPLETED === 0
        ? Money.zero(REPORTING_CURRENCY).toJSON()
        : Money.fromMinor(volume.minor / BigInt(counts.COMPLETED), REPORTING_CURRENCY).toJSON(),
    feeRevenue: fees.toJSON(),
    fxMarginRevenue: margin.toJSON(),
    grossRevenue: grossRevenue.toJSON(),
    providerCosts: costs.toJSON(),
    grossMargin: grossMargin.toJSON(),
    grossMarginPercent: grossRevenue.isZero()
      ? 0
      : round(Number(grossMargin.minor) / Number(grossRevenue.minor)),
    averageCompletionMinutes:
      completedCount === 0 ? null : Math.round(completionMinutes / completedCount),
    customers,
    newCustomers30d: newCustomers,
    activeCorridors: corridors,
    currencies,
  };
}

/** Daily transfers, volume and fee revenue for the last `days` days. */
export async function getTimeseries(days = 30): Promise<TimeseriesPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const transfers = await db.remitTransfer.findMany({
    where: { createdAt: { gte: since }, sourceCurrency: REPORTING_CURRENCY },
    select: { createdAt: true, sourceAmountMinor: true, feeMinor: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { transfers: number; volume: bigint; revenue: bigint }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    buckets.set(date, { transfers: 0, volume: 0n, revenue: 0n });
  }

  for (const transfer of transfers) {
    const key = transfer.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.transfers += 1;
    bucket.volume += transfer.sourceAmountMinor;
    if (transfer.status === "COMPLETED") bucket.revenue += transfer.feeMinor;
  }

  return [...buckets.entries()].map(([date, bucket]) => ({
    date,
    transfers: bucket.transfers,
    volume: Money.fromMinor(bucket.volume, REPORTING_CURRENCY).toDecimalString(),
    revenue: Money.fromMinor(bucket.revenue, REPORTING_CURRENCY).toDecimalString(),
  }));
}

export async function getCorridorPerformance(): Promise<CorridorPerformance[]> {
  const corridors = await db.remitCorridor.findMany({
    include: {
      sourceCountry: true,
      destCountry: true,
      transfers: { select: { status: true, sourceAmountMinor: true, sourceCurrency: true } },
    },
  });

  return corridors.map((corridor) => {
    const total = corridor.transfers.length;
    const completed = corridor.transfers.filter((t) => t.status === "COMPLETED").length;
    const settled = corridor.transfers.filter((t) =>
      ["COMPLETED", "FAILED"].includes(t.status),
    ).length;
    const volume = corridor.transfers.reduce((sum, t) => sum + t.sourceAmountMinor, 0n);
    return {
      corridor: `${corridor.sourceCountry.flagEmoji} ${corridor.sourceCountryCode} → ${corridor.destCountry.flagEmoji} ${corridor.destCountryCode}`,
      transfers: total,
      volume: Money.fromMinor(volume, corridor.sourceCurrency).format(),
      successRate: settled === 0 ? 0 : round(completed / settled),
    };
  });
}

export async function getProviderPerformance(): Promise<ProviderPerformance[]> {
  const [payments, payouts] = await Promise.all([
    db.remitPayment.groupBy({
      by: ["provider", "status"],
      _count: { _all: true },
      _sum: { providerFeeMinor: true },
    }),
    db.remitPayout.groupBy({
      by: ["provider", "status"],
      _count: { _all: true },
      _sum: { providerCostMinor: true },
    }),
  ]);

  const rows = new Map<string, ProviderPerformance>();

  const add = (
    provider: string,
    kind: "payment" | "payout",
    status: string,
    count: number,
    cost: bigint,
    currency: string,
  ) => {
    const key = `${kind}:${provider}`;
    const existing = rows.get(key) ?? {
      provider,
      kind,
      total: 0,
      succeeded: 0,
      failed: 0,
      successRate: 0,
      costs: Money.zero(currency).toDecimalString(),
    };
    existing.total += count;
    if (status === "SUCCEEDED" || status === "PAID") existing.succeeded += count;
    if (status === "FAILED" || status === "RETURNED") existing.failed += count;
    existing.costs = Money.fromDecimalString(existing.costs, currency)
      .add(Money.fromMinor(cost, currency))
      .toDecimalString();
    rows.set(key, existing);
  };

  for (const row of payments) {
    add(row.provider, "payment", row.status, row._count._all, row._sum.providerFeeMinor ?? 0n, REPORTING_CURRENCY);
  }
  for (const row of payouts) {
    // Payout costs are in the destination currency; kept separate rather than
    // silently added to the EUR figure.
    add(row.provider, "payout", row.status, row._count._all, row._sum.providerCostMinor ?? 0n, "ZAR");
  }

  return [...rows.values()].map((row) => ({
    ...row,
    successRate: row.total === 0 ? 0 : round(row.succeeded / row.total),
  }));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
