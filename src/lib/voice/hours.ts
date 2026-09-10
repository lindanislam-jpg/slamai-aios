/**
 * Business hours and timezone handling.
 *
 * All stored timestamps are UTC. A business's opening hours are wall-clock
 * times in its own timezone, so comparing "is it open now" means projecting
 * the current instant into that zone. Intl does that without a date library.
 */

export const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export type HourRow = { weekday: number; isOpen: boolean; opensAt: string; closesAt: string };

export const DEFAULT_HOURS: HourRow[] = [
  { weekday: 0, isOpen: false, opensAt: "09:00", closesAt: "17:00" },
  { weekday: 1, isOpen: true, opensAt: "09:00", closesAt: "17:30" },
  { weekday: 2, isOpen: true, opensAt: "09:00", closesAt: "17:30" },
  { weekday: 3, isOpen: true, opensAt: "09:00", closesAt: "17:30" },
  { weekday: 4, isOpen: true, opensAt: "09:00", closesAt: "17:30" },
  { weekday: 5, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
  { weekday: 6, isOpen: false, opensAt: "09:00", closesAt: "13:00" },
];

/** The wall-clock parts of an instant in a given IANA timezone. */
export function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  ) as Record<string, string>;

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);

  return {
    weekday: weekdayIndex === -1 ? date.getUTCDay() : weekdayIndex,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Is the business open at `date`? A row that closes before it opens spans midnight. */
export function isOpenAt(hours: HourRow[], timezone: string, date = new Date()): boolean {
  const parts = zonedParts(date, timezone);
  const row = hours.find((h) => h.weekday === parts.weekday);
  if (!row || !row.isOpen) return false;

  const now = parts.hour * 60 + parts.minute;
  const opens = toMinutes(row.opensAt);
  const closes = toMinutes(row.closesAt);

  if (closes <= opens) return now >= opens || now < closes;
  return now >= opens && now < closes;
}

/** A sentence the agent can say, e.g. "We're open Monday to Friday, 9am to 5:30pm." */
export function describeHours(hours: HourRow[]): string {
  const open = hours.filter((h) => h.isOpen).sort((a, b) => a.weekday - b.weekday);
  if (open.length === 0) return "No opening hours have been set.";
  return open
    .map((h) => `${WEEKDAYS[h.weekday]} ${h.opensAt}–${h.closesAt}`)
    .join(", ");
}

/** The current local time as a sentence, so the agent never guesses the date. */
export function describeNow(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Formats a stored UTC instant in the business's timezone. */
export function formatInZone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, ...options }).format(new Date(date));
}

/** A short, sane list of timezones for the onboarding picker. */
export const COMMON_TIMEZONES = [
  "Europe/Dublin", "Europe/London", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris",
  "Europe/Berlin", "Europe/Amsterdam", "Europe/Brussels", "Europe/Rome", "Europe/Warsaw",
  "Europe/Stockholm", "Europe/Helsinki", "Europe/Athens", "America/New_York",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto",
  "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland", "Asia/Dubai",
  "Asia/Singapore", "Africa/Johannesburg", "UTC",
];

export const COUNTRIES = [
  { code: "IE", name: "Ireland", timezone: "Europe/Dublin", currency: "EUR" },
  { code: "GB", name: "United Kingdom", timezone: "Europe/London", currency: "GBP" },
  { code: "US", name: "United States", timezone: "America/New_York", currency: "USD" },
  { code: "CA", name: "Canada", timezone: "America/Toronto", currency: "CAD" },
  { code: "AU", name: "Australia", timezone: "Australia/Sydney", currency: "AUD" },
  { code: "NZ", name: "New Zealand", timezone: "Pacific/Auckland", currency: "NZD" },
  { code: "DE", name: "Germany", timezone: "Europe/Berlin", currency: "EUR" },
  { code: "FR", name: "France", timezone: "Europe/Paris", currency: "EUR" },
  { code: "ES", name: "Spain", timezone: "Europe/Madrid", currency: "EUR" },
  { code: "NL", name: "Netherlands", timezone: "Europe/Amsterdam", currency: "EUR" },
  { code: "BE", name: "Belgium", timezone: "Europe/Brussels", currency: "EUR" },
  { code: "PT", name: "Portugal", timezone: "Europe/Lisbon", currency: "EUR" },
  { code: "IT", name: "Italy", timezone: "Europe/Rome", currency: "EUR" },
  { code: "ZA", name: "South Africa", timezone: "Africa/Johannesburg", currency: "ZAR" },
  { code: "AE", name: "United Arab Emirates", timezone: "Asia/Dubai", currency: "AED" },
];

export function countryDefaults(code: string) {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}
