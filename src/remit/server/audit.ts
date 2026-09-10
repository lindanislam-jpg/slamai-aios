import "server-only";
import { db } from "@/lib/db";
import type { Prisma, RemitActorType } from "@prisma/client";

/**
 * Audit trail.
 *
 * Insert-only by contract: this module exposes `record` and nothing else. There
 * is no update or delete path for `remit_audit_logs` anywhere in the codebase,
 * so a transfer's history cannot be quietly rewritten. In production the
 * database role the app connects as should additionally be granted only INSERT
 * and SELECT on this table.
 */

export interface AuditEntry {
  actorType: RemitActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.remitAuditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    // An audit write must never take down the operation it is recording, but a
    // failure here is serious and is logged loudly for alerting.
    console.error("[remit:audit] failed to write audit log", entry.action, error);
  }
}

/** Audit inside an existing transaction, so the log commits with the change. */
export async function recordAuditTx(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.remitAuditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
