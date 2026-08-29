import Stripe from "stripe";

/**
 * Stripe is optional at build time — the key only has to exist when a billing
 * route actually runs. `getStripe()` throws a clear error instead of failing
 * deep inside the SDK when the key is missing.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing is unavailable until it is configured.");
  }

  client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** The site's public origin, used for Stripe redirect URLs. */
export function siteUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3005")
  );
}
