import "server-only";
import { db } from "@/lib/db";
import { isOpenAt, zonedParts, type HourRow } from "./hours";

/**
 * Appointment slots and double-booking protection.
 *
 * The booking rule is deliberately simple and predictable: a slot is bookable
 * if it sits inside opening hours and no other non-cancelled appointment for
 * the same business overlaps it. Businesses that need per-resource capacity
 * (three vans, four chairs) extend `overlapping` with a resource filter — the
 * callers do not change.
 */

export type Slot = { startsAt: Date; endsAt: Date; label: string };

/** How far ahead the agent may offer, so it never books next year by mistake. */
export const MAX_LEAD_DAYS = 60;

export async function isSlotFree(
  businessId: string,
  startsAt: Date,
  endsAt: Date,
  ignoreAppointmentId?: string
): Promise<boolean> {
  const clash = await db.appointment.findFirst({
    where: {
      businessId,
      status: { in: ["pending", "confirmed"] },
      ...(ignoreAppointmentId && { id: { not: ignoreAppointmentId } }),
      // Two ranges overlap when each starts before the other ends.
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return !clash;
}

/**
 * The next bookable slots, in the business's own timezone.
 * Steps on the half hour, which suits every trade we ship defaults for.
 */
export async function findSlots(
  businessId: string,
  options: {
    hours: HourRow[];
    timezone: string;
    durationMin: number;
    from?: Date;
    limit?: number;
    /** Only consider this calendar day (in the business's timezone). */
    onDate?: { year: number; month: number; day: number };
  }
): Promise<Slot[]> {
  const { hours, timezone, durationMin } = options;
  const limit = options.limit ?? 5;
  const step = 30 * 60_000;
  const durationMs = durationMin * 60_000;

  // Start from the next half hour, at least 60 minutes out so nobody is
  // promised a visit that is already happening.
  const earliest = new Date((options.from ?? new Date()).getTime() + 60 * 60_000);
  let cursor = new Date(Math.ceil(earliest.getTime() / step) * step);

  const horizon = new Date(cursor.getTime() + MAX_LEAD_DAYS * 24 * 60 * 60_000);
  const slots: Slot[] = [];

  while (slots.length < limit && cursor < horizon) {
    const end = new Date(cursor.getTime() + durationMs);
    const parts = zonedParts(cursor, timezone);

    const dayMatches =
      !options.onDate ||
      (parts.year === options.onDate.year &&
        parts.month === options.onDate.month &&
        parts.day === options.onDate.day);

    if (
      dayMatches &&
      isOpenAt(hours, timezone, cursor) &&
      isOpenAt(hours, timezone, new Date(end.getTime() - 60_000)) &&
      (await isSlotFree(businessId, cursor, end))
    ) {
      slots.push({ startsAt: cursor, endsAt: end, label: describeSlot(cursor, timezone) });
    }

    cursor = new Date(cursor.getTime() + step);

    // Once past the requested day there is nothing left to find.
    if (options.onDate) {
      const next = zonedParts(cursor, timezone);
      if (
        next.year > options.onDate.year ||
        (next.year === options.onDate.year && next.month > options.onDate.month) ||
        (next.year === options.onDate.year &&
          next.month === options.onDate.month &&
          next.day > options.onDate.day)
      ) {
        break;
      }
    }
  }

  return slots;
}

/** "Tuesday 14 May at 10:30" — how the agent should say a slot out loud. */
export function describeSlot(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Resolves a spoken date and time into an instant.
 *
 * The model is asked for an ISO local datetime ("2026-05-14T10:30"); this
 * projects that wall-clock time in the business's timezone onto a UTC instant
 * by correcting for the zone's offset at that moment (which handles DST).
 */
export function localToUtc(isoLocal: string, timezone: string): Date | null {
  const match = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return null;

  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];
  // First guess: treat the wall clock as UTC, then measure how far off the
  // target zone renders it and shift by that amount.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const rendered = zonedParts(guess, timezone);
  const renderedUtc = Date.UTC(
    rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute
  );
  const offset = renderedUtc - guess.getTime();
  const corrected = new Date(guess.getTime() - offset);

  return Number.isNaN(corrected.getTime()) ? null : corrected;
}
