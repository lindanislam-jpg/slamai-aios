/**
 * SlamAI Voice pricing — the single source of truth.
 *
 * Nothing else in the app may hardcode a price, a limit or a feature list.
 * `priceEnv` names the environment variable holding that plan's Stripe price
 * id, so prices are created in Stripe and referenced here by id only.
 */

export type VoicePlanId = "trial" | "starter" | "business" | "pro" | "enterprise";

export type PlanLimits = {
  /** Included voice minutes per billing period. null = negotiated. */
  minutes: number | null;
  agents: number | null;
  seats: number | null;
  knowledgeSources: number | null;
  phoneNumbers: number | null;
  /** Appointments the AI may book per period. */
  appointments: number | null;
  /** Days of call history and transcripts retained. */
  retentionDays: number | null;
};

export type VoicePlan = {
  id: VoicePlanId;
  name: string;
  /** Monthly price in euro, excluding VAT. */
  price: number;
  currency: string;
  tagline: string;
  /** Overage charged per extra voice minute, in euro. */
  overagePerMinute: number | null;
  highlights: string[];
  cta: string;
  popular: boolean;
  priceEnv?: string;
  limits: PlanLimits;
  /** Feature keys gated by plan — see `planAllows`. */
  features: string[];
};

export const VOICE_PLANS: VoicePlan[] = [
  {
    id: "trial",
    name: "Free Trial",
    price: 0,
    currency: "EUR",
    tagline: "14 days to hear it answer your phone",
    overagePerMinute: null,
    highlights: [
      "60 included minutes",
      "1 AI receptionist",
      "Lead capture and transcripts",
      "No card required",
    ],
    cta: "Start Free",
    popular: false,
    limits: {
      minutes: 60,
      agents: 1,
      seats: 2,
      knowledgeSources: 5,
      phoneNumbers: 1,
      appointments: 25,
      retentionDays: 30,
    },
    features: ["calls", "leads", "knowledge", "appointments", "test_console"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 99,
    currency: "EUR",
    tagline: "For a small team that keeps missing calls",
    overagePerMinute: 0.18,
    highlights: [
      "500 included minutes",
      "1 AI receptionist",
      "1 phone number",
      "Appointment booking",
      "Lead capture and scoring",
      "Email notifications",
    ],
    cta: "Start Free",
    popular: false,
    priceEnv: "STRIPE_PRICE_VOICE_STARTER",
    limits: {
      minutes: 500,
      agents: 1,
      seats: 3,
      knowledgeSources: 20,
      phoneNumbers: 1,
      appointments: 200,
      retentionDays: 90,
    },
    features: ["calls", "leads", "knowledge", "appointments", "transfers", "test_console", "notifications"],
  },
  {
    id: "business",
    name: "Business",
    price: 249,
    currency: "EUR",
    tagline: "For a busy operation with real call volume",
    overagePerMinute: 0.15,
    highlights: [
      "1,500 included minutes",
      "3 AI receptionists",
      "3 phone numbers",
      "Calendar sync",
      "Call transfer rules",
      "Webhooks and n8n",
      "Full analytics",
    ],
    cta: "Start Free",
    popular: true,
    priceEnv: "STRIPE_PRICE_VOICE_BUSINESS",
    limits: {
      minutes: 1500,
      agents: 3,
      seats: 10,
      knowledgeSources: 100,
      phoneNumbers: 3,
      appointments: 1000,
      retentionDays: 365,
    },
    features: [
      "calls", "leads", "knowledge", "appointments", "transfers", "test_console",
      "notifications", "webhooks", "calendar", "analytics", "audit_log",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 499,
    currency: "EUR",
    tagline: "Multi-location, multi-agent, high volume",
    overagePerMinute: 0.12,
    highlights: [
      "4,000 included minutes",
      "10 AI receptionists",
      "10 phone numbers",
      "Priority call routing",
      "Advanced analytics",
      "API access",
      "Priority support",
    ],
    cta: "Start Free",
    popular: false,
    priceEnv: "STRIPE_PRICE_VOICE_PRO",
    limits: {
      minutes: 4000,
      agents: 10,
      seats: 25,
      knowledgeSources: 500,
      phoneNumbers: 10,
      appointments: 5000,
      retentionDays: 730,
    },
    features: [
      "calls", "leads", "knowledge", "appointments", "transfers", "test_console",
      "notifications", "webhooks", "calendar", "analytics", "audit_log", "api",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    currency: "EUR",
    tagline: "Custom volume, custom terms",
    overagePerMinute: null,
    highlights: [
      "Negotiated minutes",
      "Unlimited receptionists and numbers",
      "SSO and custom contracts",
      "Dedicated onboarding",
      "SLA",
    ],
    cta: "Talk to Sales",
    popular: false,
    priceEnv: "STRIPE_PRICE_VOICE_ENTERPRISE",
    limits: {
      minutes: null,
      agents: null,
      seats: null,
      knowledgeSources: null,
      phoneNumbers: null,
      appointments: null,
      retentionDays: null,
    },
    features: [
      "calls", "leads", "knowledge", "appointments", "transfers", "test_console",
      "notifications", "webhooks", "calendar", "analytics", "audit_log", "api", "sso",
    ],
  },
];

export function getVoicePlan(id: string | null | undefined): VoicePlan {
  return VOICE_PLANS.find((p) => p.id === id) ?? VOICE_PLANS[0];
}

/** Plans a customer can actually buy, in display order. */
export const PURCHASABLE_PLANS = VOICE_PLANS.filter((p) => p.id !== "trial");

export function planAllows(planId: string | null | undefined, feature: string): boolean {
  return getVoicePlan(planId).features.includes(feature);
}

/** null means unlimited, so an unlimited plan never trips a limit check. */
export function isWithinLimit(limit: number | null, current: number): boolean {
  return limit === null || current < limit;
}

export const TRIAL_DAYS = 14;
