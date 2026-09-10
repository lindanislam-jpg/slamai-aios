import { clientIp, jsonOk, parseBody, route } from "@/remit/server/api";
import { requireCustomer } from "@/remit/server/auth";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { issueVerificationCode } from "@/remit/server/customer-service";
import { resendCodeSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** POST /api/remit/auth/verify/resend — issue a fresh code. */
export const POST = route(async (request) => {
  const customer = await requireCustomer();
  enforceRateLimit("auth", `${customer.id}:${clientIp(request)}`);

  const input = await parseBody(request, resendCodeSchema);
  const { destination, devCode } = await issueVerificationCode(customer, input.channel);

  return jsonOk({ sent: true, destination: maskDestination(destination), devCode });
});

function maskDestination(destination: string): string {
  if (destination.includes("@")) {
    const [local, domain] = destination.split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  return `${"*".repeat(Math.max(0, destination.length - 3))}${destination.slice(-3)}`;
}
