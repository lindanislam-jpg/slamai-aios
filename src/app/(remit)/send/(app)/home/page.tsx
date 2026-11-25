import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeCorridor, serializeTransfer } from "@/remit/server/serialize";
import { Money } from "@/remit/money/money";
import {
  Alert,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  SandboxBadge,
  StatusPill,
} from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home" };

/**
 * Customer home: what they can do, what is in flight, and what it costs.
 */
export default async function SendHomePage() {
  const customer = await requireCustomer();

  const [corridors, transfers, feeRule] = await Promise.all([
    db.remitCorridor.findMany({
      where: { isActive: true },
      include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
    }),
    db.remitTransfer.findMany({
      where: { customerId: customer.id },
      include: { recipient: true, corridor: { select: { isLive: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.remitFeeRule.findFirst({
      where: { isActive: true, corridorId: null },
      orderBy: { priority: "desc" },
    }),
  ]);

  const routes = corridors.map(serializeCorridor);
  const recent = transfers.map((transfer) => serializeTransfer(transfer));
  const inFlight = recent.filter(
    (transfer) => !["COMPLETED", "FAILED", "CANCELLED"].includes(transfer.status),
  );
  const standardFee = feeRule
    ? Money.fromMinor(feeRule.fixedFeeMinor, feeRule.currency).format()
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${customer.fullName.split(" ")[0]}`}
        description="Send money, check a rate, or follow a transfer that is on its way."
      />

      {customer.status === "PENDING_VERIFICATION" && (
        <Alert tone="warning" title="Verify your email">
          Confirm your email address to activate your account.{" "}
          <Link href="/send/verify" className="font-bold underline">
            Enter your code
          </Link>
        </Alert>
      )}

      {customer.kycStatus !== "APPROVED" && customer.status !== "PENDING_VERIFICATION" && (
        <Alert tone="warning" title="Finish identity verification">
          Transfers are held for review until your identity is verified.{" "}
          <Link href="/send/verify-identity" className="font-bold underline">
            Verify now
          </Link>
        </Alert>
      )}

      {/* --- Quick send ------------------------------------------------- */}
      <Card className="bg-send-ink text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-white/60">
              Quick send
            </div>
            <h2 className="mt-1 text-[22px] font-bold leading-tight">
              {standardFee ? `${standardFee} flat fee` : "Flat transfer fee"}, whatever you send
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
              We show the rate, the fee and the exact amount your recipient gets before you pay.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/send/new"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-white px-5 text-[15px] font-bold text-send-ink hover:bg-white/90"
          >
            Send money
          </Link>
          <Link
            href="/send/rates"
            className="inline-flex min-h-[48px] items-center rounded-xl border border-white/25 px-5 text-[15px] font-bold text-white hover:bg-white/10"
          >
            Check a rate
          </Link>
        </div>
      </Card>

      {/* --- In flight ---------------------------------------------------- */}
      {inFlight.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-bold text-send-ink">In progress</h2>
          <div className="space-y-2">
            {inFlight.map((transfer) => (
              <Link
                key={transfer.id}
                href={`/send/transactions/${transfer.id}`}
                className="send-card flex items-center gap-3 p-4 transition hover:border-send-primary"
              >
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-send-primary-soft text-[17px]"
                >
                  ⏳
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-send-ink">
                    {transfer.destAmount.formatted} to {transfer.recipient?.fullName}
                  </span>
                  <span className="block text-[12px] text-send-muted">{transfer.reference}</span>
                </span>
                <StatusPill status={transfer.status} label={transfer.statusLabel} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --- Available routes --------------------------------------------- */}
      <section>
        <h2 className="mb-3 text-[15px] font-bold text-send-ink">Where you can send</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {routes.map((route) => (
            <Card key={route.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[16px] font-bold text-send-ink">
                  {route.source.flag} {route.source.currency} → {route.destination.flag}{" "}
                  {route.destination.currency}
                </div>
                <div className="mt-0.5 text-[12px] text-send-muted">
                  {route.source.name} to {route.destination.name} · {route.estimatedDelivery}
                </div>
                <div className="mt-1 text-[12px] text-send-muted">
                  {route.minAmount.formatted} – {route.maxAmount.formatted}
                </div>
              </div>
              {!route.isLive && <SandboxBadge />}
            </Card>
          ))}
        </div>
      </section>

      {/* --- Recent ------------------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-send-ink">Recent transfers</h2>
          <Link href="/send/transactions" className="text-[13px] font-semibold text-send-primary">
            See all
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No transfers yet"
            body="Your first transfer takes about a minute. You will see the fee and the exact recipient amount before you confirm anything."
            action={<LinkButton href="/send/new">Send money</LinkButton>}
          />
        ) : (
          <div className="space-y-2">
            {recent.map((transfer) => (
              <Link
                key={transfer.id}
                href={`/send/transactions/${transfer.id}`}
                className="send-card flex items-center gap-3 p-4 transition hover:border-send-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-send-ink">
                    {transfer.recipient?.fullName ?? "Recipient"}
                  </span>
                  <span className="block text-[12px] text-send-muted">
                    {new Date(transfer.createdAt).toLocaleDateString("en-IE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {transfer.reference}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[15px] font-bold text-send-ink">
                    {transfer.sourceAmount.formatted}
                  </span>
                  <span className="tnum block text-[12px] text-send-muted">
                    {transfer.destAmount.formatted}
                  </span>
                </span>
                <StatusPill status={transfer.status} label={transfer.statusLabel} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
