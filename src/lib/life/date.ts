import type { Clock, ISODate } from "./types";

/** Local-time date key. `toISOString()` is deliberately avoided — it shifts to UTC. */
export function dateKey(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key: ISODate): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: ISODate, n: number): ISODate {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Most recent `n` day keys ending at `end` (inclusive), oldest first. */
export function lastNDays(n: number, end: ISODate = dateKey()): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

/** Monday-based week containing `key`. */
export function weekOf(key: ISODate = dateKey()): ISODate[] {
  const d = parseKey(key);
  const dow = (d.getDay() + 6) % 7;
  const monday = addDays(key, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function monthOf(key: ISODate = dateKey()): ISODate[] {
  const d = parseKey(key);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => addDays(dateKey(first), i));
}

/** Minutes since local midnight for a `HH:MM` clock string. */
export function clockToMinutes(c: Clock): number {
  const [h, m] = c.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToClock(mins: number): Clock {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function nowClock(d: Date = new Date()): Clock {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutesNow(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Signed distance in minutes from `target` to `actual`, taking the shorter way
 * around the clock so a 23:50 bedtime against a 00:10 target reads as −20, not +1420.
 */
export function clockDelta(target: Clock, actual: Clock): number {
  let delta = clockToMinutes(actual) - clockToMinutes(target);
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return delta;
}

export function formatDelta(mins: number): string {
  const sign = mins > 0 ? "+" : mins < 0 ? "−" : "±";
  const abs = Math.abs(Math.round(mins));
  return `${sign}${abs} min${abs === 1 ? "" : "s"}`;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function shortDate(key: ISODate): string {
  return parseKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function weekdayShort(key: ISODate): string {
  return parseKey(key).toLocaleDateString(undefined, { weekday: "short" });
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
