import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError } from "@/lib/voice/http";
import { getStripe, isStripeConfigured, siteUrl } from "@/lib/stripe";

export const runtime = "nodejs";

/** Stripe's own portal handles upgrades, downgrades, cancellation and invoices. */
export async function POST() {
  const gate = await requireTenant({ permission: "billing.write", write: true });
  if (!gate.ok) return gate.response;

  if (!isStripeConfigured()) {
    return badRequest("Billing isn't configured yet.");
  }

  try {
    const subscription = await db.subscription.findUnique({
      where: { businessId: gate.ctx.businessId },
      select: { stripeCustomerId: true },
    });
    if (!subscription?.stripeCustomerId) {
      return badRequest("You don't have a subscription yet. Choose a plan first.");
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${siteUrl()}/app/billing`,
    });

    return ok({ url: session.url });
  } catch (err) {
    return serverError("billing.portal", err);
  }
}
