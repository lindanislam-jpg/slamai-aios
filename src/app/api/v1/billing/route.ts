import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError } from "@/lib/voice/http";
import { VOICE_PLANS, getVoicePlan } from "@/lib/voice/plans";
import { priceIdFor } from "@/lib/voice/billing";
import { isStripeConfigured } from "@/lib/stripe";
import { getUsageSummary } from "@/lib/voice/usage";

export async function GET() {
  const gate = await requireTenant({ permission: "billing.read" });
  if (!gate.ok) return gate.response;

  try {
    const subscription = await db.subscription.findUnique({
      where: { businessId: gate.ctx.businessId },
    });
    const usage = await getUsageSummary(
      gate.ctx.businessId,
      subscription?.planId ?? "trial",
      subscription?.minutesOverride
    );

    return ok({
      subscription,
      plan: getVoicePlan(subscription?.planId),
      usage,
      // A plan without a configured Stripe price cannot be bought yet; the UI
      // says so rather than opening a checkout that would fail.
      plans: VOICE_PLANS.map((p) => ({ ...p, purchasable: Boolean(priceIdFor(p)) })),
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    return serverError("billing", err);
  }
}
