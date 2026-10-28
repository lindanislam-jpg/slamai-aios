/**
 * Scheduled-review timing in Irish local time (Europe/Dublin), including
 * daylight-saving changes. Pure functions so the schedule is testable.
 *
 * Hosting calls the tick endpoint at fixed UTC hours that cover both GMT and
 * IST (08/09, 11/12, 17/18 UTC). The tick works out which Dublin slot is due;
 * the run key "YYYY-MM-DD@HH:MM" makes each slot run at most once.
 */

export const TIME_ZONE = "Europe/Dublin";
export const DEFAULT_SLOTS = ["09:00", "12:00", "18:00"] as const;

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Wall-clock parts of an instant in Dublin. */
export function dublinParts(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Minutes Dublin is ahead of UTC at instant d (0 in winter, 60 in summer). */
export function dublinOffsetMinutes(d: Date) {
  const p = dublinParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant of a Dublin wall-clock time on a Dublin calendar date. */
export function dublinToUtc(date: string, hhmm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - dublinOffsetMinutes(new Date(guess)) * 60000;
  // Re-check at the candidate instant in case the guess straddled a DST change.
  t = guess - dublinOffsetMinutes(new Date(t)) * 60000;
  return new Date(t);
}

export const dublinDate = (d: Date) => {
  const p = dublinParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export interface Slot { key: string; date: string; time: string; at: Date }

export const slotKey = (date: string, time: string) => `${date}@${time}`;

/** Slots from `days` days before `now` up to and including today, oldest first. */
export function slotsAround(now: Date, slots: readonly string[] = DEFAULT_SLOTS, days = 2): Slot[] {
  const today = dublinDate(now);
  const out: Slot[] = [];
  for (let i = -days; i <= 1; i++) {
    const date = addDays(today, i);
    for (const time of [...slots].sort()) out.push({ key: slotKey(date, time), date, time, at: dublinToUtc(date, time) });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * What a tick at `now` should do.
 *  - due: the latest slot whose time has passed, if within the catch-up window.
 *  - missed: earlier slots in the look-back that were never run and are now
 *    past the catch-up window (recorded, not run late).
 */
export function planTick(now: Date, done: Set<string>, opts: { slots?: readonly string[]; catchUpHours?: number; lookBackDays?: number; since?: Date | null } = {}) {
  const catchUpMs = (opts.catchUpHours ?? 3) * 3_600_000;
  const all = slotsAround(now, opts.slots ?? DEFAULT_SLOTS, opts.lookBackDays ?? 2);
  // Slots before the monitor was switched on are neither due nor missed.
  const past = all.filter((s) => s.at.getTime() <= now.getTime() && (!opts.since || s.at.getTime() >= opts.since.getTime()));
  const latest = past[past.length - 1];
  const due = latest && !done.has(latest.key) && now.getTime() - latest.at.getTime() <= catchUpMs ? latest : null;
  const missed = past.filter((s) => s !== due && !done.has(s.key) && now.getTime() - s.at.getTime() > catchUpMs);
  return { due, missed };
}

/** The next slot strictly after `now`. */
export function nextSlot(now: Date, slots: readonly string[] = DEFAULT_SLOTS): Slot {
  return slotsAround(now, slots, 0).find((s) => s.at.getTime() > now.getTime())!;
}

/** "Wed 28 Oct 2026, 09:00 IST/GMT"-style label in Dublin time. */
export function fmtDublin(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IE", { timeZone: TIME_ZONE, weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(d));
}
