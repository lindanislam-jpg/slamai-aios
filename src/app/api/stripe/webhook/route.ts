import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { planIdForPrice } from "@/lib/plan-pricing";

// Stripe signature verification needs the raw body, so this route must stay dynamic.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Applies a subscription's current state to the user it belongs to. */
async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const user = await db.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn(`Stripe webhook: no user for customer ${customerId}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planFromPrice = priceId ? planIdForPrice(priceId) : null;
  const planFromMeta  = subscription.metadata?.plan as string | undefined;

  // An active or trialing subscription grants the plan; anything else drops to free.
  const entitled = subscription.status === "active" || subscription.status === "trialing";
  const plan = entitled ? (planFromPrice || planFromMeta || user.plan) : "free";

  await db.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId:        priceId,
      stripeStatus:         subscription.status,
      planRenewsAt:         new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set — refusing to trust this webhook.");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await getStripe().subscriptions.retrieve(id);
          await syncSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await db.user.updateMany({
            where: { stripeCustomerId: customerId },
            data:  { stripeStatus: "past_due" },
          });
        }
        break;
      }

      default:
        // Everything else is acknowledged and ignored.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries rather than dropping the event.
    console.error(`Stripe webhook handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
