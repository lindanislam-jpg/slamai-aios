import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { serializeTransfer } from "@/remit/server/serialize";
import { transferSearchSchema } from "@/remit/validation/schemas";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/remit/admin/transfers?query=&status=&compliance=&page=
 * Search and filter every transfer on the platform.
 */
export const GET = route(async (request) => {
  await requireAdmin(PERMISSIONS.VIEW_TRANSFERS);
  const url = new URL(request.url);
  const input = transferSearchSchema.parse(Object.fromEntries(url.searchParams));

  const where: Prisma.RemitTransferWhereInput = {};
  if (input.status) where.status = input.status as Prisma.RemitTransferWhereInput["status"];
  if (input.compliance) {
    where.complianceStatus = input.compliance as Prisma.RemitTransferWhereInput["complianceStatus"];
  }
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
        customer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.remitTransfer.count({ where }),
  ]);

  return jsonOk({
    transfers: transfers.map((transfer) => ({
      ...serializeTransfer(transfer),
      customer: transfer.customer,
      riskScore: transfer.riskScore,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  });
});
