import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError } from "@/lib/voice/http";
import { getUsageSummary, periodKey } from "@/lib/voice/usage";
import { getVoicePlan } from "@/lib/voice/plans";

export async function GET() {
  const gate = await requireTenant();
  if (!gate.ok) return gate.response;

  try {
    const subscription = await db.subscription.findUnique({
      where: { businessId: gate.ctx.businessId },
    });

    const current = await getUsageSummary(
      gate.ctx.businessId,
      subscription?.planId ?? "trial",
      subscription?.minutesOverride
    );

    // The three previous periods, so an owner can see a trend.
    const history = await Promise.all(
      [1, 2, 3].map(async (back) => {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - back, 1);
        return getUsageSummary(
          gate.ctx.businessId,
          subscription?.planId ?? "trial",
          subscription?.minutesOverride,
          periodKey(d)
        );
      })
    );

    return ok({
      current,
      history: history.reverse(),
      plan: getVoicePlan(subscription?.planId),
      subscription,
    });
  } catch (err) {
    return serverError("usage", err);
  }
}
