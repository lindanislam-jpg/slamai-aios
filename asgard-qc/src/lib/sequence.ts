import type { Tx } from "./db";

/** Issue the next human-readable reference, e.g. nextCode(tx, "NCR", 4) → NCR-0007.
 *  The upsert row-locks the counter so concurrent inserts never collide. */
export async function nextCode(tx: Tx, prefix: string, pad = 4): Promise<string> {
  const row = await tx.sequence.upsert({
    where: { name: prefix },
    create: { name: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(row.value).padStart(pad, "0")}`;
}
