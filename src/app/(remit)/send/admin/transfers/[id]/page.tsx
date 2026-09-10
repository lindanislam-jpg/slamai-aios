import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";
import { redactRecipientDetails } from "@/remit/corridors/recipient-schema";
import { Money } from "@/remit/money/money";
import { Card, PageHeader, SandboxBadge, StatusPill, SummaryRow } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfer detail" };

/** Full operational view of one transfer, including raw provider responses. */
export default async function AdminTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin(PERMISSIONS.VIEW_TRANSFERS);
  const { id } = await params;

  const transfer = await db.remitTransfer.findUnique({
    where: { id },
    include: {
      customer: true,
      recipient: true,
      corridor: true,
      quote: true,
      events: { orderBy: { createdAt: "asc" } },
      payments: true,
      payouts: true,
      reviews: true,
    },
  });
  if (!transfer) notFound();

  const dto = serializeTransfer(transfer);
  const providerCost = Money.fromMinor(transfer.providerCostMinor, transfer.sourceCurrency);
  const fee = Money.fromMinor(transfer.feeMinor, transfer.sourceCurrency);
  const contribution = fee.subtract(providerCost);

  return (
    <div className="space-y-4">
      <Link href="/send/admin/transfers" className="text-[13px] font-semibold text-send-body hover:text-send-primary">
        ← All transfers
      </Link>

      <PageHeader
        title={dto.reference}
        description={`${transfer.customer.fullName} → ${transfer.recipient.fullName}`}
        action={
          <div className="flex items-center gap-2">
            {dto.isSandbox && <SandboxBadge />}
            <StatusPill status={dto.status} label={dto.statusLabel} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-[15px] font-bold text-send-ink">Pricing snapshot</h2>
          <p className="mt-0.5 text-[12px] text-send-muted">
            Frozen at confirmation. Never recalculated.
          </p>
          <div className="mt-2 divide-y divide-send-line">
            <SummaryRow label="Sent" value={dto.sourceAmount.formatted} />
            <SummaryRow label="Fee charged" value={dto.fee.formatted} tone="accent" />
            <SummaryRow label="Total collected" value={dto.totalPayable.formatted} emphasis />
            <SummaryRow label="Market rate" value={transfer.marketRate.toString()} />
            <SummaryRow
              label="Customer rate"
              value={`${transfer.customerRate.toString()} (${transfer.fxMarginBps} bps margin)`}
            />
            <SummaryRow label="Paid out" value={dto.destAmount.formatted} tone="primary" />
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-bold text-send-ink">Unit economics</h2>
          <p className="mt-0.5 text-[12px] text-send-muted">
            What this single transfer actually earned.
          </p>
          <div className="mt-2 divide-y divide-send-line">
            <SummaryRow label="Fee revenue" value={fee.format()} />
            <SummaryRow label="Provider costs" value={`− ${providerCost.format()}`} />
            <SummaryRow
              label="Contribution"
              value={contribution.format()}
              emphasis
              tone={contribution.isNegative() ? undefined : "primary"}
            />
            <SummaryRow label="Risk score" value={`${transfer.riskScore} / 100`} />
            <SummaryRow
              label="Risk signals"
              value={transfer.riskReasons.length ? transfer.riskReasons.join(", ") : "None"}
            />
            <SummaryRow label="Compliance" value={transfer.complianceStatus} />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Recipient</h2>
        <p className="mt-0.5 text-[12px] text-send-muted">
          Sensitive fields are masked here too — an admin view is not a reason to expose a full
          account number.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {Object.entries(
            redactRecipientDetails(
              transfer.recipient.destCountryCode,
              transfer.recipient.payoutMethod,
              transfer.recipient.details as Record<string, unknown>,
            ),
          ).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-send-line px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                {key}
              </dt>
              <dd className="mt-0.5 text-[14px] font-semibold text-send-ink">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Status history</h2>
        <p className="mt-0.5 text-[12px] text-send-muted">Append-only. Rows are never edited.</p>
        <ol className="mt-3 divide-y divide-send-line">
          {transfer.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[13px]">
              <span className="tnum w-[150px] shrink-0 text-send-muted">
                {event.createdAt.toLocaleString("en-IE")}
              </span>
              <span className="font-bold text-send-ink">
                {event.fromStatus ? `${event.fromStatus} → ` : ""}
                {event.toStatus}
              </span>
              <span className="rounded bg-send-canvas px-2 py-0.5 text-[11px] font-bold uppercase text-send-muted">
                {event.actorType}
              </span>
              {event.reason && <span className="text-send-body">{event.reason}</span>}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProviderCard
          title="Payments"
          rows={transfer.payments.map((payment) => ({
            id: payment.id,
            provider: payment.provider,
            ref: payment.providerRef,
            status: payment.status,
            amount: Money.fromMinor(payment.amountMinor, payment.currency).format(),
            cost: Money.fromMinor(payment.providerFeeMinor, payment.currency).format(),
            raw: payment.rawResponse,
          }))}
        />
        <ProviderCard
          title="Payouts"
          rows={transfer.payouts.map((payout) => ({
            id: payout.id,
            provider: payout.provider,
            ref: payout.providerRef,
            status: payout.status,
            amount: Money.fromMinor(payout.amountMinor, payout.currency).format(),
            cost: Money.fromMinor(payout.providerCostMinor, payout.currency).format(),
            raw: payout.rawResponse,
          }))}
        />
      </div>
    </div>
  );
}

function ProviderCard({
  title,
  rows,
}: {
  title: string;
  rows: {
    id: string;
    provider: string;
    ref: string | null;
    status: string;
    amount: string;
    cost: string;
    raw: unknown;
  }[];
}) {
  return (
    <Card>
      <h2 className="text-[15px] font-bold text-send-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-send-muted">None recorded.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-send-line p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="font-bold text-send-ink">{row.provider}</span>
                <span className="rounded bg-send-canvas px-2 py-0.5 text-[11px] font-bold uppercase text-send-body">
                  {row.status}
                </span>
              </div>
              <div className="tnum mt-1 text-[12px] text-send-muted">
                {row.amount} · cost {row.cost} · {row.ref ?? "no reference"}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] font-semibold text-send-primary">
                  Provider response
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-send-canvas p-3 text-[11px] leading-relaxed text-send-body">
                  {JSON.stringify(row.raw, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
