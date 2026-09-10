import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { Money } from "@/remit/money/money";

export const dynamic = "force-dynamic";

/** GET /api/remit/admin/customers?query= — customer list with activity. */
export const GET = route(async (request) => {
  await requireAdmin(PERMISSIONS.VIEW_CUSTOMERS);
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";

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
  const volumeByCustomer = new Map(volumes.map((row) => [row.customerId, row._sum.sourceAmountMinor ?? 0n]));

  return jsonOk({
    customers: customers.map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      status: customer.status,
      kycStatus: customer.kycStatus,
      riskScore: customer.riskScore,
      isDemo: customer.isDemo,
      countryCode: customer.countryCode,
      transfers: customer._count.transfers,
      lifetimeVolume: Money.fromMinor(volumeByCustomer.get(customer.id) ?? 0n, "EUR").toJSON(),
      createdAt: customer.createdAt.toISOString(),
    })),
  });
});
