/**
 * Brand system.
 *
 * The company name is deliberately not hardcoded anywhere else in the codebase.
 * Change `NEXT_PUBLIC_REMIT_BRAND_NAME` (or the defaults below) and the whole
 * product — landing page, emails, transfer references, legal pages — follows.
 */

export const brand = {
  name: process.env.NEXT_PUBLIC_REMIT_BRAND_NAME || "Kora",
  /** Shown in the wordmark next to the name; keep it short. */
  suffix: process.env.NEXT_PUBLIC_REMIT_BRAND_SUFFIX || "Send",
  tagline:
    process.env.NEXT_PUBLIC_REMIT_TAGLINE ||
    "Send money. Know the cost. Know what they get.",
  supportEmail: process.env.NEXT_PUBLIC_REMIT_SUPPORT_EMAIL || "support@example.com",
  /** Prefix for customer-facing transfer references, e.g. KS-7QK4-2M9X. */
  referencePrefix: process.env.NEXT_PUBLIC_REMIT_REFERENCE_PREFIX || "KS",
  /**
   * Legal entity name used on legal pages and emails. Left as a placeholder
   * on purpose — no regulatory status is claimed anywhere in this codebase.
   */
  legalEntity: process.env.NEXT_PUBLIC_REMIT_LEGAL_ENTITY || "[Legal entity name]",
} as const;

export function wordmark(): string {
  return `${brand.name}${brand.suffix}`;
}
