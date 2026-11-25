import "server-only";

/**
 * In-process rate limiting for the endpoints that face the public internet:
 * signup, password reset, the demo form and the test console.
 *
 * This is per-instance, so on a multi-instance deployment it caps abuse per
 * instance rather than globally. That is enough to stop scripted abuse and
 * runaway cost; if you need a global limit, back `hit` with Redis — the
 * signature does not change. Documented in docs/SECURITY.md.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function hit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Builds a bucket key from the caller's IP and a route name. */
export function limitKey(route: string, req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `${route}:${ip}`;
}
