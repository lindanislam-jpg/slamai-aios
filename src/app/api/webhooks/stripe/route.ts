import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { planIdForPrice, normaliseStatus } from "@/lib/voice/billing";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe billing events.
 *
 * The signature is verified against the raw body before anything is read — an
 * unverified webhook could otherwise upgrade any workspace for free.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");

  if (!secret || !signature) {
    console.error("[stripe] webhook received without a signing secret or signature.");
    return new Response("Forbidden", { status: 403 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = session.metadata?.businessId;
        if (businessId && session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(
            typeof session.subscription === "string" ? session.subscription : session.subscription.id
          );
          await applySubscription(businessId, subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const businessId =
          subscription.metadata?.businessId ?? (await businessIdForCustomer(subscription.customer));
        if (businessId) {
          if (event.type === "customer.subscription.deleted") {
            await db.subscription.updateMany({
              where: { businessId },
              data: { status: "canceled", planId: "trial", cancelAtPeriodEnd: false },
            });
            await recordAudit({ businessId, action: "billing.subscription_cancelled" });
          } else {
            await applySubscription(businessId, subscription);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const businessId = await businessIdForCustomer(invoice.customer);
        if (businessId) {
          await db.subscription.updateMany({ where: { businessId }, data: { status: "past_due" } });
          await recordAudit({ businessId, action: "billing.payment_failed" });
        }
        break;
      }

      default:
        // Everything else is acknowledged so Stripe stops retrying it.
        break;
    }
  } catch (err) {
    console.error("[stripe] handler failed for", event.type, err);
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}

async function businessIdForCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | null> {
  if (!customer) return null;
  const id = typeof customer === "string" ? customer : customer.id;
  const record = await db.subscription.findUnique({
    where: { stripeCustomerId: id },
    select: { businessId: true },
  });
  return record?.businessId ?? null;
}

async function applySubscription(businessId: string, subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const planId =
    (priceId ? planIdForPrice(priceId) : null) ??
    (subscription.metadata?.planId as string | undefined) ??
    "starter";

  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end;

  await db.subscription.updateMany({
    where: { businessId },
    data: {
      planId,
      status: normaliseStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripePriceId: priceId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(periodEnd && { currentPeriodEnd: new Date(periodEnd * 1000) }),
      ...(subscription.trial_end && { trialEndsAt: new Date(subscription.trial_end * 1000) }),
    },
  });

  await recordAudit({
    businessId,
    action: "billing.subscription_updated",
    metadata: { planId, status: subscription.status },
  });
}
