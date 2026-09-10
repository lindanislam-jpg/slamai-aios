import { jsonOk, route } from "@/remit/server/api";
import { requireCustomer } from "@/remit/server/auth";
import { startKyc } from "@/remit/server/customer-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/kyc — begin identity verification with the KYC provider.
 * The provider owns the flow; we only record its reference and its decision.
 */
export const POST = route(async (request) => {
  const customer = await requireCustomer();
  const origin = new URL(request.url).origin;
  const result = await startKyc(customer, `${origin}/send/verify/identity`);
  return jsonOk(result);
});
