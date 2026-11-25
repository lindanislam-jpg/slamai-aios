import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, hasPermission, requireAdmin } from "@/remit/server/auth";
import { Money } from "@/remit/money/money";
import { CustomerTable } from "@/components/remit/CustomerTable";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAdmin(PERMISSIONS.VIEW_CUSTOMERS);
  const raw = await searchParams;
  const query = typeof raw.query === "string" ? raw.query.trim() : "";

  const customers = await db.remitCustomer.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { fullName: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { transfers: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const volumes = await db.remitTransfer.groupBy({
    by: ["customerId"],
    where: { status: "COMPLETED" },
    _sum: { sourceAmountMinor: true },
  });
  const byCustomer = new Map(volumes.map((row) => [row.customerId, row._sum.sourceAmountMinor ?? 0n]));

  return (
    <div>
      <PageHeader title="Customers" description={`${customers.length} shown.`} />
      <CustomerTable
        query={query}
        canSuspend={hasPermission(context.admin, PERMISSIONS.SUSPEND_CUSTOMERS)}
        customers={customers.map((customer) => ({
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          status: customer.status,
          kycStatus: customer.kycStatus,
          riskScore: customer.riskScore,
          isDemo: customer.isDemo,
          countryCode: customer.countryCode,
          transfers: customer._count.transfers,
          lifetimeVolume: Money.fromMinor(byCustomer.get(customer.id) ?? 0n, "EUR").format(),
          createdAt: customer.createdAt.toISOString(),
          suspendedReason: customer.suspendedReason,
        }))}
      />
    </div>
  );
}
