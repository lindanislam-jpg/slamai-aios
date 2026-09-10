/**
 * Lead scoring, 0–100.
 *
 * Deliberately a transparent rubric rather than a model call: a business owner
 * must be able to understand why a lead scored what it did, and the score must
 * not change because a model was updated. The AI supplies the *signals*
 * (urgency, intent, budget); this file turns them into a number.
 */

export type LeadSignals = {
  /** The caller left a usable phone number or it came from caller ID. */
  hasPhone: boolean;
  hasEmail: boolean;
  hasName: boolean;
  /** They named a service the business actually offers. */
  namedService: boolean;
  /** An appointment was booked on the call. */
  booked: boolean;
  /** "emergency" | "urgent" | "normal" | "browsing" */
  urgency: string;
  /** "book" | "quote" | "enquiry" | "support" | "complaint" | "spam" | "unknown" */
  intent: string;
  /** Seconds. A caller who stayed on the line is more engaged. */
  durationSec: number;
  /** They gave a budget or described a large job. */
  highValue: boolean;
  /** They asked to be called back or to go ahead. */
  readyToProceed: boolean;
};

export type ScoredLead = {
  score: number;
  band: "hot" | "warm" | "cold";
  reasons: string[];
};

export function scoreLead(signals: LeadSignals): ScoredLead {
  let score = 0;
  const reasons: string[] = [];

  const add = (points: number, reason: string) => {
    score += points;
    if (points !== 0) reasons.push(`${points > 0 ? "+" : ""}${points} ${reason}`);
  };

  // Contactability — a lead you cannot ring back is worth little.
  if (signals.hasPhone) add(20, "phone number captured");
  if (signals.hasName) add(5, "gave their name");
  if (signals.hasEmail) add(5, "gave an email address");

  // Intent.
  switch (signals.intent) {
    case "book": add(25, "wanted to book"); break;
    case "quote": add(20, "asked for a quote"); break;
    case "enquiry": add(10, "service enquiry"); break;
    case "support": add(5, "existing customer support"); break;
    case "complaint": add(0, "complaint, not a new sale"); break;
    case "spam": add(-30, "looks like a cold sales call"); break;
    default: break;
  }

  // Urgency.
  switch (signals.urgency) {
    case "emergency": add(20, "emergency"); break;
    case "urgent": add(12, "urgent"); break;
    case "browsing": add(-5, "just browsing"); break;
    default: break;
  }

  if (signals.namedService) add(8, "named a service you offer");
  if (signals.booked) add(20, "booked an appointment");
  if (signals.highValue) add(12, "large or high-value job");
  if (signals.readyToProceed) add(10, "ready to go ahead");

  // Engagement.
  if (signals.durationSec >= 120) add(5, "stayed on the call over two minutes");
  else if (signals.durationSec < 20) add(-10, "hung up almost immediately");

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return { score: clamped, band: bandFor(clamped), reasons };
}

export function bandFor(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export const BAND_LABELS = {
  hot: { label: "Hot", icon: "🔥", tone: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
  warm: { label: "Warm", icon: "🟠", tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  cold: { label: "Cold", icon: "🔵", tone: "text-sky-300 bg-sky-500/10 border-sky-500/30" },
} as const;
