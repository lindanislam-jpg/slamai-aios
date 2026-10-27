import type { Prisma } from "@prisma/client";
import type { Tx } from "./db";
import type { Actor } from "./permissions";

/** Strip noise so before/after snapshots stay readable. */
function snapshot(obj: unknown): Prisma.InputJsonValue | undefined {
  if (obj == null) return undefined;
  return JSON.parse(
    JSON.stringify(obj, (k, v) => (k === "passwordHash" || k === "updatedAt" ? undefined : v)),
  ) as Prisma.InputJsonValue;
}

/** Append an entry to the audit trail. Call inside the same transaction as
 *  the change so the history can never disagree with the data. */
export async function recordEvent(
  tx: Tx,
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string,
  opts: { summary?: string; before?: unknown; after?: unknown } = {},
) {
  await tx.auditEvent.create({
    data: {
      actorId: actor?.id,
      actorName: actor?.name ?? "system",
      action,
      entityType,
      entityId,
      summary: opts.summary,
      before: snapshot(opts.before),
      after: snapshot(opts.after),
    },
  });
}

/** Only the fields that actually changed, for compact edit history. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const x = before[key];
    const y = after[key];
    const same = x instanceof Date && y instanceof Date ? x.getTime() === y.getTime() : JSON.stringify(x) === JSON.stringify(y);
    if (!same) {
      b[key] = x;
      a[key] = y;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}
