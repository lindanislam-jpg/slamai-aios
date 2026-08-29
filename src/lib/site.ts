/**
 * Real business details shown on the public site.
 *
 * These are deliberately not hardcoded: set them in .env.local and Vercel.
 * Anything left empty is hidden on the page rather than shown as a
 * placeholder — the site should never display a number nobody answers.
 */
export const site = {
  /** The Twilio number visitors can ring to hear the voice agent. */
  demoNumber: process.env.NEXT_PUBLIC_DEMO_NUMBER || "",
  /** Where sales enquiries go. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /** Optional booking link (Calendly, Cal.com, etc.). */
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || "",
};

/** A phone number with spaces stripped, for tel: links. */
export function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export const hasDemoNumber = () => Boolean(site.demoNumber);
