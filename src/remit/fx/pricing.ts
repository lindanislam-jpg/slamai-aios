import { Decimal, RateDecimal, bpsToDecimal, Money } from "../money/money";

/**
 * FX pricing.
 *
 * Four numbers are kept strictly separate and all four are shown to the
 * customer. Hiding an FX margin inside "the rate" is the standard trick in this
 * industry and the entire proposition here is not doing it:
 *
 *   marketRate    the mid-market rate from the FX provider
 *   fxMarginBps   our margin on top, in basis points (0 = we take none)
 *   customerRate  the rate actually applied = marketRate * (1 - margin)
 *   fee           the flat transfer fee, charged separately
 */

export interface RatePricing {
  marketRate: Decimal;
  customerRate: Decimal;
  fxMarginBps: number;
}

export function priceRate(marketRate: Decimal | string | number, fxMarginBps: number): RatePricing {
  const market = new RateDecimal(marketRate.toString());
  if (market.lessThanOrEqualTo(0)) {
    throw new Error(`Market rate must be positive, received ${market.toString()}`);
  }
  if (!Number.isInteger(fxMarginBps) || fxMarginBps < 0 || fxMarginBps > 10_000) {
    throw new Error(`FX margin must be an integer between 0 and 10000 bps, received ${fxMarginBps}`);
  }
  const customer = market.times(new RateDecimal(1).minus(bpsToDecimal(fxMarginBps)));
  return {
    marketRate: market,
    // 8 dp matches the Decimal(18,8) column the rate is stored in, so the
    // number quoted and the number persisted are always identical.
    customerRate: customer.toDecimalPlaces(8, Decimal.ROUND_DOWN),
    fxMarginBps,
  };
}

/**
 * What our FX margin earns on this transfer, expressed in the source currency.
 * Used by the analytics/margin reporting so revenue is never overstated as
 * "the €5 fee" alone.
 */
export function fxMarginRevenue(sourceAmount: Money, fxMarginBps: number): Money {
  if (fxMarginBps === 0) return Money.zero(sourceAmount.currency);
  return sourceAmount.multiply(bpsToDecimal(fxMarginBps));
}
