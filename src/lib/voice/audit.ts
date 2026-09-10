import "server-only";
import { db } from "@/lib/db";

/**
 * Records a meaningful action against a workspace. Auditing must never break
 * the operation it is recording, so every failure is swallowed and logged.
 */
export async function recordAudit(input: {
  businessId: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  try {
    await db.auditLog.create({
      data: {
        businessId: input.businessId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.req ? clientIp(input.req) : null,
        userAgent: input.req?.headers.get("user-agent")?.slice(0, 255) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", input.action, err);
  }
}

/** Best-effort client IP behind a proxy. */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? null;
}
