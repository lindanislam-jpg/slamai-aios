import { clientIp, jsonOk, parseBody, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { createQuote } from "@/remit/server/quote-service";
import { serializeQuote } from "@/remit/server/serialize";
import { quoteSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/transfers/quote
 *
 * Every number the customer sees comes from here. The request carries the
 * corridor, the amount and the methods — never a fee, a rate or a total.
 */
export const POST = route(async (request) => {
  const customer = await requireActiveCustomer();
  enforceRateLimit("quote", customer.id || clientIp(request));

  const input = await parseBody(request, quoteSchema);
  const { quote, corridor } = await createQuote({
    customerId: customer.id,
    sourceCountryCode: input.sourceCountryCode,
    destCountryCode: input.destCountryCode,
    sourceAmount: input.sourceAmount,
    paymentMethod: input.paymentMethod,
    payoutMethod: input.payoutMethod,
    promoCode: input.promoCode,
  });

  return jsonOk({ quote: serializeQuote(quote, corridor) }, 201);
});
