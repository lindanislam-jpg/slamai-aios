/**
 * The single source of truth for plans. The landing page, the settings page and
 * Stripe checkout all read from here, so a price only ever changes in one place.
 *
 * `priceEnv` names the environment variable holding that plan's Stripe price ID.
 */
export type PlanId = "free" | "starter" | "professional" | "business" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  popular: boolean;
  priceEnv?: string;
  /** Hard limits enforced server-side. null = unlimited. */
  limits: { agents: number | null; contacts: number | null; seats: number | null };
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    tagline: "Kick the tyres",
    features: ["1 user", "1 AI assistant", "25 contacts", "Community support"],
    cta: "Current plan",
    popular: false,
    limits: { agents: 1, contacts: 25, seats: 1 },
  },
  {
    id: "starter",
    name: "Starter",
    price: 49,
    period: "month",
    tagline: "For a solo operator",
    features: ["1 user", "3 AI assistants", "Basic automation", "5 GB storage", "Email support"],
    cta: "Start Free Trial",
    popular: false,
    priceEnv: "STRIPE_PRICE_STARTER",
    limits: { agents: 3, contacts: 500, seats: 1 },
  },
  {
    id: "professional",
    name: "Professional",
    price: 149,
    period: "month",
    tagline: "For a growing team",
    features: ["5 users", "All AI agents", "CRM system", "Marketing AI", "Analytics", "Website builder", "Priority support"],
    cta: "Get Started",
    popular: true,
    priceEnv: "STRIPE_PRICE_PROFESSIONAL",
    limits: { agents: 25, contacts: 10000, seats: 5 },
  },
  {
    id: "business",
    name: "Business",
    price: 499,
    period: "month",
    tagline: "For a full operation",
    features: ["Unlimited users", "Voice AI", "Advanced automations", "Custom branding", "API access", "Dedicated manager"],
    cta: "Get Started",
    popular: false,
    priceEnv: "STRIPE_PRICE_BUSINESS",
    limits: { agents: null, contacts: null, seats: null },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 1999,
    period: "month",
    tagline: "For white-label and scale",
    features: ["Everything in Business", "White-label platform", "Custom AI agents", "SLA guarantee", "Onboarding & training"],
    cta: "Contact Sales",
    popular: false,
    priceEnv: "STRIPE_PRICE_ENTERPRISE",
    limits: { agents: null, contacts: null, seats: null },
  },
];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}
