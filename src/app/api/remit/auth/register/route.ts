import { clientIp, jsonOk, parseBody, route, userAgent } from "@/remit/server/api";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { issueVerificationCode, registerCustomer } from "@/remit/server/customer-service";
import { registerSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/auth/register
 *
 * Creates the account and issues an email verification code. The password is
 * hashed with bcrypt (cost 12) before it touches the database; the raw value is
 * never logged or stored.
 */
export const POST = route(async (request) => {
  enforceRateLimit("auth", clientIp(request));
  const input = await parseBody(request, registerSchema);

  const customer = await registerCustomer({
    fullName: input.fullName,
    email: input.email,
    password: input.password,
    countryCode: input.countryCode,
    phone: input.phone || undefined,
    ip: clientIp(request),
    userAgent: userAgent(request),
  });

  const { devCode } = await issueVerificationCode(customer, "EMAIL");

  return jsonOk(
    {
      customerId: customer.id,
      email: customer.email,
      status: customer.status,
      // Present outside production only, so the flow is completable without a
      // live email provider connected.
      devCode,
    },
    201,
  );
});
