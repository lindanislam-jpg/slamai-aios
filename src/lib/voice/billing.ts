import "server-only";
import { VOICE_PLANS, type VoicePlan, type VoicePlanId } from "./plans";

/**
 * Stripe price resolution. Prices live in Stripe; this module is the only
 * place that maps a plan id to a price id and back, so a price change never
 * means touching application code.
 */

export function priceIdFor(plan: VoicePlan): string | null {
  if (!plan.priceEnv) return null;
  return process.env[plan.priceEnv] || null;
}

export function planIdForPrice(priceId: string): VoicePlanId | null {
  for (const plan of VOICE_PLANS) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan.id;
  }
  return null;
}

/** Maps a Stripe subscription status onto our own vocabulary. */
export function normaliseStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return stripeStatus;
    case "incomplete_expired":
    case "unpaid":
      return "past_due";
    case "paused":
      return "canceled";
    default:
      return stripeStatus;
  }
}
