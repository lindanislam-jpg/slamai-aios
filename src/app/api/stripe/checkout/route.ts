import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest, serverError } from "@/lib/api";
import { getStripe, isStripeConfigured, siteUrl } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";
import { priceIdFor } from "@/lib/plan-pricing";

type CheckoutBody = { plan?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Add STRIPE_SECRET_KEY and the plan price IDs." },
      { status: 503 }
    );
  }

  const body = await readJson<CheckoutBody>(req);
  const plan = PLANS.find((p) => p.id === body?.plan);
  if (!plan) return badRequest("Unknown plan");
  if (plan.id === "free") return badRequest("The free plan does not need checkout");

  const priceId = priceIdFor(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the ${plan.name} plan (set ${plan.priceEnv}).` },
      { status: 503 }
    );
  }

  const user = await db.user.findUnique({ where: { id: gate.userId } });
  if (!user) return badRequest("User not found");

  try {
    const stripe = getStripe();

    // Reuse the customer across checkouts so the portal and webhooks line up.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: user.id, plan: plan.id },
      },
      metadata: { userId: user.id, plan: plan.id },
      success_url: `${siteUrl()}/settings?checkout=success`,
      cancel_url:  `${siteUrl()}/settings?checkout=cancelled`,
    });

    if (!session.url) return serverError("Stripe did not return a checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return serverError("Could not start checkout. Please try again.");
  }
}
