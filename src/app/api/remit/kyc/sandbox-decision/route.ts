import { forbidden, jsonOk, parseBody, route } from "@/remit/server/api";
import { requireCustomer } from "@/remit/server/auth";
import { applyKycDecision } from "@/remit/server/customer-service";
import { settings } from "@/remit/config/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

/**
 * POST /api/remit/kyc/sandbox-decision
 *
 * Stands in for the KYC provider's webhook so the journey can be completed in a
 * demo. Refuses unless demo mode is on AND the configured KYC provider is the
 * sandbox one — it can never affect a real verification.
 */
export const POST = route(async (request) => {
  const customer = await requireCustomer();
  if (!settings.demoMode || settings.providers.kyc !== "sandbox") {
    throw forbidden("Identity verification is handled by the verification provider");
  }

  const { decision } = await parseBody(request, schema);
  const updated = await applyKycDecision(customer.id, decision, "Sandbox decision");
  return jsonOk({ kycStatus: updated.kycStatus, status: updated.status });
});
