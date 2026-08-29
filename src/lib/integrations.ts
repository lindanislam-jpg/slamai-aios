/**
 * The providers the platform knows about. Connecting one records the user's
 * choice; exchanging real OAuth tokens is handled per-provider and is not
 * wired up yet, so a connected provider here means "enabled by the user".
 */
export const PROVIDERS = [
  "gmail", "slack", "shopify", "stripe", "hubspot",
  "whatsapp", "calendar", "quickbooks",
] as const;

export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}
