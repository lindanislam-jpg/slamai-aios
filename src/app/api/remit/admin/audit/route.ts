import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const query = z.object({
  entityId: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

/** GET /api/remit/admin/audit — read-only view of the append-only audit trail. */
export const GET = route(async (request) => {
  await requireAdmin(PERMISSIONS.VIEW_AUDIT);
  const input = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  const pageSize = 50;

  const where = {
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.action ? { action: { contains: input.action, mode: "insensitive" as const } } : {}),
  };

  const [logs, total] = await Promise.all([
    db.remitAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * pageSize,
      take: pageSize,
    }),
    db.remitAuditLog.count({ where }),
  ]);

  return jsonOk({
    logs: logs.map((log) => ({
      id: log.id,
      actorType: log.actorType,
      actorId: log.actorId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page: input.page,
    pageSize,
  });
});
