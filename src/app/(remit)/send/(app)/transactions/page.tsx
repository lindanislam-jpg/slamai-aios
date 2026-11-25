import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";
import { EmptyState, LinkButton, PageHeader, StatusPill } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transactions" };

export default async function SendTransactionsPage() {
  const customer = await requireCustomer();
  const transfers = await db.remitTransfer.findMany({
    where: { customerId: customer.id },
    include: { recipient: true, corridor: { select: { isLive: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows = transfers.map((transfer) => serializeTransfer(transfer));

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every transfer, with the fee and rate you were quoted at the time."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Once you send your first transfer it will appear here with its full timeline."
          action={<LinkButton href="/send/new">Send money</LinkButton>}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((transfer) => (
            <li key={transfer.id}>
              <Link
                href={`/send/transactions/${transfer.id}`}
                className="send-card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:border-send-primary"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-send-ink">
                    {transfer.recipient?.fullName ?? "Recipient"}
                  </div>
                  <div className="text-[12px] text-send-muted">
                    {new Date(transfer.createdAt).toLocaleString("en-IE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {transfer.reference}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tnum text-[15px] font-bold text-send-ink">
                    {transfer.sourceAmount.formatted}
                  </div>
                  <div className="tnum text-[12px] text-send-muted">
                    → {transfer.destAmount.formatted}
                  </div>
                </div>
                <StatusPill status={transfer.status} label={transfer.statusLabel} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
