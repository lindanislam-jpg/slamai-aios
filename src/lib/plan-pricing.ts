import "server-only";
import { PLANS, type Plan, type PlanId } from "./plans";

// Server-only: these read Stripe price IDs from the environment, which must
// never be resolved in a client bundle.

/** Resolves a plan's Stripe price ID from the environment. Returns null when unconfigured. */
export function priceIdFor(plan: Plan): string | null {
  if (!plan.priceEnv) return null;
  return process.env[plan.priceEnv] || null;
}

/** Maps a Stripe price ID back to a plan id, for the webhook. */
export function planIdForPrice(priceId: string): PlanId | null {
  for (const plan of PLANS) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan.id;
  }
  return null;
}
