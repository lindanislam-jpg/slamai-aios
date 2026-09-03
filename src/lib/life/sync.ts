/**
 * Merging two copies of a life.
 *
 * Life OS stays local-first: every device owns a complete copy in localStorage
 * and keeps working with no network. Sync is a second step on top of that, so
 * two copies can always have diverged — you logged the morning on the laptop
 * and the evening on the phone, and both are right.
 *
 * The merge is deliberately boring, because a clever merge that loses a day is
 * worse than a simple one you can predict:
 *
 *   days     merged one day at a time; for a day both sides changed, the newer
 *            `updatedAt` wins whole. Days only one side has are always kept.
 *   coach    merged by message id, since it is an append-only transcript.
 *   the rest single values (settings, profile, north star, challenge, book,
 *            people, places, environment). These cannot be combined without
 *            guessing, so the side with the newer `touchedAt` wins all of them
 *            together, and the UI says so.
 *
 * There are no tombstones: deleting a person on one device while the other is
 * offline will bring them back if the offline device edits its own list later.
 * That is a real limit, stated rather than hidden.
 */

import type { CoachMessage, DayRecord, ISODate, LifeState } from "./types";

const stamp = (d: DayRecord | undefined): number => d?.updatedAt ?? 0;

/** Merges the day logs, keeping the newer version of any day both sides hold. */
function mergeDays(
  local: Record<ISODate, DayRecord>,
  remote: Record<ISODate, DayRecord>,
): Record<ISODate, DayRecord> {
  const out: Record<ISODate, DayRecord> = { ...remote };
  for (const [key, day] of Object.entries(local)) {
    // A tie goes to local: the device in front of you should never appear to
    // undo the edit you just made.
    if (stamp(day) >= stamp(remote[key])) out[key] = day;
  }
  return out;
}

/** Merges two coach transcripts by id, oldest first, keeping the tail. */
function mergeCoach(local: CoachMessage[], remote: CoachMessage[], limit = 200): CoachMessage[] {
  const byId = new Map<string, CoachMessage>();
  for (const m of [...remote, ...local]) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-limit);
}

/**
 * Combines this device's state with the server's copy.
 *
 * Both arguments are left untouched; the result is a new object safe to store
 * and to push straight back to the server.
 */
export function mergeStates(local: LifeState, remote: LifeState): LifeState {
  const localNewer = (local.touchedAt ?? 0) >= (remote.touchedAt ?? 0);
  // The singletons travel together. Taking settings from one side and the
  // challenge from the other would produce a state neither device ever had.
  const singletons = localNewer ? local : remote;

  return {
    ...singletons,
    version: Math.max(local.version, remote.version),
    // Whichever install is older is the one that has been going longer.
    createdAt: local.createdAt < remote.createdAt ? local.createdAt : remote.createdAt,
    seededAt: local.seededAt ?? remote.seededAt,
    touchedAt: Math.max(local.touchedAt ?? 0, remote.touchedAt ?? 0),
    days: mergeDays(local.days, remote.days),
    coach: mergeCoach(local.coach, remote.coach),
  };
}

/**
 * True when the merge produced something the server has not got yet, i.e. this
 * device has changes worth pushing. Cheap structural check, not a deep compare.
 */
export function differsFrom(merged: LifeState, remote: LifeState): boolean {
  if ((merged.touchedAt ?? 0) !== (remote.touchedAt ?? 0)) return true;
  if (merged.coach.length !== remote.coach.length) return true;
  const keys = Object.keys(merged.days);
  if (keys.length !== Object.keys(remote.days).length) return true;
  return keys.some((k) => stamp(merged.days[k]) !== stamp(remote.days[k]));
}

/* ------------------------------------------------------------------ *
 * Wire format
 * ------------------------------------------------------------------ */

export interface SyncPayload {
  data: LifeState | null;
  revision: number;
  updatedAt: string | null;
}

/** What the client shows about its own connection. Never claims more than is true. */
export type SyncStatus =
  | "off" // not signed in — this device only
  | "idle" // signed in, nothing pending
  | "syncing"
  | "offline" // saved here, will push when the network returns
  | "error";
