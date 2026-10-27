import { z } from "zod";

/** Form helpers: browsers send "" for empty inputs; treat that as null. */
export const optStr = (max = 2000) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v), z.string().max(max).nullable().optional());

export const reqStr = (max = 2000) => z.string().trim().min(1, "Required").max(max);

export const optDate = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? v : d;
}, z.date().nullable().optional());

export const reqDate = z.preprocess((v) => (v === "" || v == null ? undefined : new Date(String(v))), z.date({ error: "Valid date required" }));

export const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable().optional());

export const bool = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());

export const optId = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().min(1).nullable().optional());

/** Convert FormData into a plain object; repeated keys become arrays. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (typeof v !== "string") continue;
    if (k in out) {
      const cur = out[k];
      out[k] = Array.isArray(cur) ? [...cur, v] : [cur, v];
    } else out[k] = v;
  }
  return out;
}

/** Keep only keys present in the input so partial updates don't null out fields. */
export function present<T extends Record<string, unknown>>(parsed: T, raw: Record<string, unknown>): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(parsed) as (keyof T)[]) if ((k as string) in raw) out[k] = parsed[k];
  return out;
}
