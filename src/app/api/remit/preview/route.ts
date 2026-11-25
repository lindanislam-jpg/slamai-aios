import { clientIp, jsonOk, parseBody, route } from "@/remit/server/api";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { Money } from "@/remit/money/money";
import { settings } from "@/remit/config/settings";
import { calculateQuote } from "@/remit/quotes/quote-calculator";
import { findCorridor, loadFeeRules } from "@/remit/server/quote-service";
import { getFxProvider } from "@/remit/providers/registry";
import { formatDeliveryEstimate, formatRateDisplay } from "@/remit/server/serialize";
import { quoteSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/preview
 *
 * An indicative price for the public landing-page calculator. Computed
 * server-side by the same code that prices a real quote — the browser is never
 * trusted with a fee, a rate or a total, even for a preview.
 *
 * Nothing is persisted and this can never become a transfer: confirming
 * requires a signed-in customer and a stored quote from POST
 * /api/remit/transfers/quote.
 */
export const POST = route(async (request) => {
  enforceRateLimit("quote", clientIp(request));
  const input = await parseBody(request, quoteSchema);

  const corridor = await findCorridor(input.sourceCountryCode, input.destCountryCode);
  const rate = await getFxProvider(corridor.fxProviderKey).getRate(
    corridor.sourceCurrency,
    corridor.destCurrency,
  );

  const calculation = calculateQuote({
    corridorId: corridor.id,
    sourceAmount: Money.fromDecimalString(input.sourceAmount, corridor.sourceCurrency),
    destCurrency: corridor.destCurrency,
    marketRate: rate.marketRate,
    fxMarginBps: corridor.fxMarginBps,
    feeRules: await loadFeeRules(corridor.id),
    minAmountMinor: corridor.minAmountMinor,
    maxAmountMinor: corridor.maxAmountMinor,
    estimatedMinMins: corridor.estimatedMinMins,
    estimatedMaxMins: corridor.estimatedMaxMins,
    ttlSeconds: settings.quoteTtlSeconds,
  });

  return jsonOk({
    preview: {
      sourceAmount: calculation.sourceAmount.toJSON(),
      fee: calculation.fee.toJSON(),
      totalPayable: calculation.totalPayable.toJSON(),
      destAmount: calculation.destAmount.toJSON(),
      rateDisplay: formatRateDisplay(
        corridor.sourceCurrency,
        corridor.destCurrency,
        calculation.customerRate.toString(),
      ),
      fxMarginBps: calculation.fxMarginBps,
      estimatedDelivery: formatDeliveryEstimate(
        calculation.estimatedMinMins,
        calculation.estimatedMaxMins,
      ),
      isSandbox: !corridor.isLive,
    },
  });
});
