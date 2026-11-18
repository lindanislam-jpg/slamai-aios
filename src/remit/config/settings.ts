/**
 * Runtime settings for the remittance module.
 *
 * Every credential comes from an environment variable; nothing secret is
 * committed and nothing secret is prefixed `NEXT_PUBLIC_`.
 */

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

export const settings = {
  /**
   * Demo mode lets anyone walk the full journey against sandbox providers.
   * It is on by default outside production so the product can be shown
   * without a regulated provider connected. It never moves real money.
   */
  demoMode: bool("REMIT_DEMO_MODE", process.env.NODE_ENV !== "production"),

  /** How long a quote is honoured before the customer must request a new one. */
  quoteTtlSeconds: int("REMIT_QUOTE_TTL_SECONDS", 15 * 60),

  /** Provider selection. `sandbox` implementations are always available. */
  providers: {
    payment: process.env.REMIT_PAYMENT_PROVIDER || "sandbox",
    payout: process.env.REMIT_PAYOUT_PROVIDER || "sandbox",
    fx: process.env.REMIT_FX_PROVIDER || "sandbox",
    kyc: process.env.REMIT_KYC_PROVIDER || "sandbox",
    notification: process.env.REMIT_NOTIFICATION_PROVIDER || "sandbox",
    screening: process.env.REMIT_SCREENING_PROVIDER || "sandbox",
  },

  /** Compliance thresholds. Tunable without touching the risk rules. */
  compliance: {
    /** Transfers at or above this (source minor units) always get reviewed. */
    manualReviewThresholdMinor: BigInt(int("REMIT_REVIEW_THRESHOLD_MINOR", 100_000)),
    /** Transfers at or above this require completed KYC before payment. */
    kycRequiredThresholdMinor: BigInt(int("REMIT_KYC_THRESHOLD_MINOR", 0)),
    /** Number of transfers in 24h that trips the velocity rule. */
    velocityCountPerDay: int("REMIT_VELOCITY_COUNT_PER_DAY", 5),
  },

  /** Simple in-process rate limits (requests per window, per identity). */
  rateLimits: {
    quote: { limit: int("REMIT_RATE_LIMIT_QUOTE", 30), windowMs: 60_000 },
    transfer: { limit: int("REMIT_RATE_LIMIT_TRANSFER", 10), windowMs: 60_000 },
    auth: { limit: int("REMIT_RATE_LIMIT_AUTH", 10), windowMs: 15 * 60_000 },
    default: { limit: int("REMIT_RATE_LIMIT_DEFAULT", 120), windowMs: 60_000 },
  },

  /**
   * Webhook secrets are read lazily on every access rather than captured when
   * this module first loads. That way a secret injected after startup (a
   * secrets manager, a rotation) is picked up without a redeploy, and module
   * import order can never silently leave us with an empty secret — which
   * would fail every signature check.
   */
  webhooks: {
    get stripeSecret(): string {
      return process.env.STRIPE_WEBHOOK_SECRET || "";
    },
    get payoutSecret(): string {
      return process.env.REMIT_PAYOUT_WEBHOOK_SECRET || "";
    },
  },
} as const;

/**
 * True when a corridor's providers are only sandbox implementations, which the
 * UI must surface so a demo is never mistaken for real money movement.
 */
export function isSandboxProvider(key: string): boolean {
  return key === "sandbox";
}
