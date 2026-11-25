import "server-only";
import { settings } from "../config/settings";
import { tooManyRequests } from "./api";

/**
 * Fixed-window rate limiter.
 *
 * In-process, so it protects a single instance. Behind more than one instance
 * this must be backed by Redis or the platform's edge rate limiter — the
 * interface below stays the same. It is a real control against scripted abuse
 * of quoting and auth, not a substitute for provider-side limits.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitBucket = keyof typeof settings.rateLimits;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(bucket: RateLimitBucket, identity: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const config = settings.rateLimits[bucket] ?? settings.rateLimits.default;
  const key = `${bucket}:${identity}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const window = { count: 1, resetAt: now + config.windowMs };
    windows.set(key, window);
    return { allowed: true, remaining: config.limit - 1, resetAt: window.resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= config.limit,
    remaining: Math.max(0, config.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Throws a 429 when the caller is over the limit. */
export function enforceRateLimit(bucket: RateLimitBucket, identity: string): void {
  const result = checkRateLimit(bucket, identity);
  if (!result.allowed) {
    const seconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    throw tooManyRequests(`Too many requests. Try again in ${seconds}s.`);
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}
