import { db, type Tx } from "../db";
import { ForbiddenError, NotFoundError } from "../errors";
import type { Actor, Permission } from "../permissions";

export function assertCan(actor: Actor, perm: Permission) {
  if (!actor.permissions.has(perm)) throw new ForbiddenError();
}

export function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction((tx) => fn(tx), { timeout: 20_000 });
}

export function found<T>(row: T | null | undefined, what: string): T {
  if (!row) throw new NotFoundError(what);
  return row;
}

/** Common list filters shared by registers. */
export interface ListFilter {
  projectId?: string | null;
  from?: Date | null;
  to?: Date | null;
  q?: string | null;
  take?: number;
  skip?: number;
}

export function dateRange(from?: Date | null, to?: Date | null) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

export const PAGE_SIZE = 50;
