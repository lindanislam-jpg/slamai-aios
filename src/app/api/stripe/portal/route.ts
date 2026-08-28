import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { getStripe, isStripeConfigured, siteUrl } from "@/lib/stripe";

/** Opens the Stripe customer portal so the user can change or cancel their plan. */
export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const user = await db.user.findUnique({ where: { id: gate.userId } });
  if (!user?.stripeCustomerId) {
    return badRequest("No billing account yet — subscribe to a plan first.");
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${siteUrl()}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal failed:", err);
    return serverError("Could not open the billing portal. Please try again.");
  }
}
