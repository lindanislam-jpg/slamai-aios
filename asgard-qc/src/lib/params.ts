/** Helpers for reading filters from searchParams. */
export type SP = Record<string, string | string[] | undefined>;

export const str = (sp: SP, k: string) => {
  const v = sp[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
};

export const dateParam = (sp: SP, k: string, endOfDay = false) => {
  const s = str(sp, k);
  if (!s) return null;
  const d = new Date(s + (endOfDay && s.length === 10 ? "T23:59:59.999Z" : s.length === 10 ? "T00:00:00Z" : ""));
  return Number.isNaN(d.getTime()) ? null : d;
};

export function enumParam<T extends string>(sp: SP, k: string, values: readonly T[]): T | null {
  const s = str(sp, k);
  return s && (values as readonly string[]).includes(s) ? (s as T) : null;
}

export const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
] as const;

export function periodRange(sp: SP) {
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to", true);
  if (from || to) return { from: from ?? new Date(0), to: to ?? new Date(), label: "Custom range" };
  const days = Number(str(sp, "period") ?? 30);
  const n = [7, 30, 90, 365].includes(days) ? days : 30;
  return { from: new Date(Date.now() - n * 86_400_000), to: new Date(), label: PERIODS.find((p) => p.value === String(n))!.label };
}
