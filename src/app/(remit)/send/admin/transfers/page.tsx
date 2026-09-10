import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";
import { transferSearchSchema } from "@/remit/validation/schemas";
import { TRANSFER_STATUSES } from "@/remit/transfers/status";
import { Card, PageHeader, StatusPill } from "@/components/remit/ui";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfers" };

export default async function AdminTransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin(PERMISSIONS.VIEW_TRANSFERS);
  const raw = await searchParams;
  const input = transferSearchSchema.parse({
    query: typeof raw.query === "string" ? raw.query : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });

  const where: Prisma.RemitTransferWhereInput = {};
  if (input.status) where.status = input.status as Prisma.RemitTransferWhereInput["status"];
  if (input.query) {
    where.OR = [
      { reference: { contains: input.query, mode: "insensitive" } },
      { customer: { email: { contains: input.query, mode: "insensitive" } } },
      { customer: { fullName: { contains: input.query, mode: "insensitive" } } },
      { recipient: { fullName: { contains: input.query, mode: "insensitive" } } },
    ];
  }

  const [transfers, total] = await Promise.all([
    db.remitTransfer.findMany({
      where,
      include: {
        recipient: true,
        corridor: { select: { isLive: true } },
        customer: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.remitTransfer.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / input.pageSize));

  return (
    <div>
      <PageHeader title="Transfers" description={`${total} transfer${total === 1 ? "" : "s"} on the platform.`} />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="query"
            defaultValue={input.query}
            placeholder="Reference, customer or recipient"
            className="min-w-[220px] flex-1 rounded-xl border border-send-line px-4 py-2.5 text-[14px]"
          />
          <select
            name="status"
            defaultValue={input.status ?? ""}
            className="rounded-xl border border-send-line px-4 py-2.5 text-[14px]"
          >
            <option value="">Any status</option>
            {TRANSFER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
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
              <th className="px-4 py-3 font-bold">Reference</th>
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Recipient</th>
              <th className="px-4 py-3 text-right font-bold">Sent</th>
              <th className="px-4 py-3 text-right font-bold">Received</th>
              <th className="px-4 py-3 text-right font-bold">Fee</th>
              <th className="px-4 py-3 text-right font-bold">Risk</th>
              <th className="px-4 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-send-line">
            {transfers.map((row) => {
              const dto = serializeTransfer(row);
              return (
                <tr key={row.id} className="hover:bg-send-canvas">
                  <td className="px-4 py-3">
                    <Link
                      href={`/send/admin/transfers/${row.id}`}
                      className="font-bold text-send-primary hover:underline"
                    >
                      {dto.reference}
                    </Link>
                    <div className="text-[11px] text-send-muted">
                      {row.createdAt.toLocaleDateString("en-IE")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-send-ink">{row.customer.fullName}</div>
                    <div className="text-[11px] text-send-muted">{row.customer.email}</div>
                  </td>
                  <td className="px-4 py-3 text-send-body">{row.recipient.fullName}</td>
                  <td className="tnum px-4 py-3 text-right font-semibold">
                    {dto.sourceAmount.formatted}
                  </td>
                  <td className="tnum px-4 py-3 text-right">{dto.destAmount.formatted}</td>
                  <td className="tnum px-4 py-3 text-right text-send-warning">
                    {dto.fee.formatted}
                  </td>
                  <td className="tnum px-4 py-3 text-right">{row.riskScore}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={dto.status} label={dto.statusLabel} />
                  </td>
                </tr>
              );
            })}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-send-muted">
                  No transfers match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[13px]">
          {Array.from({ length: pages }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={`/send/admin/transfers?page=${page}${input.query ? `&query=${encodeURIComponent(input.query)}` : ""}${input.status ? `&status=${input.status}` : ""}`}
              className={`rounded-lg px-3 py-1.5 font-bold ${
                page === input.page ? "bg-send-primary text-white" : "text-send-body hover:bg-white"
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
