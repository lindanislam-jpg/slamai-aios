import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError, parseBody } from "@/lib/voice/http";
import { z } from "zod";
import { getStripe, isStripeConfigured, siteUrl } from "@/lib/stripe";
import { getVoicePlan } from "@/lib/voice/plans";
import { priceIdFor } from "@/lib/voice/billing";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "billing.write", write: true });
  if (!gate.ok) return gate.response;

  if (!isStripeConfigured()) {
    return badRequest("Billing isn't configured yet. Add your Stripe keys to enable subscriptions.");
  }

  const body = await parseBody(req, z.object({ planId: z.string() }));
  if (!body.ok) return body.response;

  const plan = getVoicePlan(body.data.planId);
  if (plan.id === "trial") return badRequest("The trial can't be purchased.");

  const priceId = priceIdFor(plan);
  if (!priceId) {
    return badRequest(`The ${plan.name} plan has no Stripe price configured yet. Contact us to get set up.`);
  }

  try {
    const stripe = getStripe();
    const subscription = await db.subscription.findUnique({
      where: { businessId: gate.ctx.businessId },
    });

    let customerId = subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: gate.ctx.userEmail,
        name: gate.ctx.businessName,
        // The tenant id travels on the customer so the webhook can find its
        // way back to the right workspace no matter which event fires.
        metadata: { businessId: gate.ctx.businessId },
      });
      customerId = customer.id;
      await db.subscription.update({
        where: { businessId: gate.ctx.businessId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl()}/app/billing?checkout=success`,
      cancel_url: `${siteUrl()}/app/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { businessId: gate.ctx.businessId, planId: plan.id } },
      metadata: { businessId: gate.ctx.businessId, planId: plan.id },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "billing.checkout_started",
      metadata: { planId: plan.id },
      req,
    });

    return ok({ url: session.url });
  } catch (err) {
    return serverError("billing.checkout", err);
  }
}
