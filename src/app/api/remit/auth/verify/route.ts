import { clientIp, jsonOk, parseBody, route } from "@/remit/server/api";
import { requireCustomer } from "@/remit/server/auth";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { confirmVerificationCode } from "@/remit/server/customer-service";
import { verifyCodeSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** POST /api/remit/auth/verify — confirm an email or phone code. */
export const POST = route(async (request) => {
  const customer = await requireCustomer();
  enforceRateLimit("auth", `${customer.id}:${clientIp(request)}`);

  const input = await parseBody(request, verifyCodeSchema);
  const updated = await confirmVerificationCode(customer, input.channel, input.code);

  return jsonOk({
    status: updated.status,
    emailVerified: Boolean(updated.emailVerifiedAt),
    phoneVerified: Boolean(updated.phoneVerifiedAt),
  });
});
