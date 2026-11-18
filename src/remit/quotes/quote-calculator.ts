import { Money } from "../money/money";
import { calculateFee, type FeeRule } from "../fees/fee-engine";
import { priceRate } from "../fx/pricing";
import type { Decimal } from "../money/money";

/**
 * Pure quote arithmetic. No database, no network — everything this needs is
 * passed in, which is what makes the €5-fee and FX behaviour exhaustively
 * testable.
 *
 * The customer pays: sourceAmount + fee.
 * The recipient gets: sourceAmount converted at the customer rate.
 *
 * The fee is charged on top of the send amount rather than deducted from it, so
 * "send €300" means the recipient's side is calculated from the full €300.
 */

export interface QuoteInput {
  corridorId: string;
  sourceAmount: Money;
  destCurrency: string;
  marketRate: Decimal | string | number;
  fxMarginBps: number;
  feeRules: FeeRule[];
  segment?: string | null;
  promoCode?: string | null;
  minAmountMinor: bigint;
  maxAmountMinor: bigint;
  estimatedMinMins: number;
  estimatedMaxMins: number;
  ttlSeconds: number;
  now?: Date;
}

export interface QuoteCalculation {
  sourceAmount: Money;
  fee: Money;
  feeRuleId: string | null;
  feeRuleName: string | null;
  totalPayable: Money;
  destAmount: Money;
  marketRate: Decimal;
  customerRate: Decimal;
  fxMarginBps: number;
  estimatedMinMins: number;
  estimatedMaxMins: number;
  createdAt: Date;
  expiresAt: Date;
}

export class AmountOutOfRangeError extends Error {
  constructor(
    readonly amount: Money,
    readonly min: Money,
    readonly max: Money,
  ) {
    super(
      amount.lessThan(min)
        ? `Minimum transfer is ${min.format()}`
        : `Maximum transfer is ${max.format()}`,
    );
    this.name = "AmountOutOfRangeError";
  }
}

export function calculateQuote(input: QuoteInput): QuoteCalculation {
  const now = input.now ?? new Date();
  const { sourceAmount } = input;

  if (!sourceAmount.isPositive()) {
    throw new Error("Transfer amount must be greater than zero");
  }

  const min = Money.fromMinor(input.minAmountMinor, sourceAmount.currency);
  const max = Money.fromMinor(input.maxAmountMinor, sourceAmount.currency);
  if (sourceAmount.lessThan(min) || sourceAmount.greaterThan(max)) {
    throw new AmountOutOfRangeError(sourceAmount, min, max);
  }

  const { fee, rule } = calculateFee(input.feeRules, {
    corridorId: input.corridorId,
    sourceAmount,
    segment: input.segment,
    promoCode: input.promoCode,
    at: now,
  });

  const { marketRate, customerRate, fxMarginBps } = priceRate(input.marketRate, input.fxMarginBps);
  const destAmount = sourceAmount.convert(customerRate, input.destCurrency);
  const totalPayable = sourceAmount.add(fee);

  return {
    sourceAmount,
    fee,
    feeRuleId: rule?.id ?? null,
    feeRuleName: rule?.name ?? null,
    totalPayable,
    destAmount,
    marketRate,
    customerRate,
    fxMarginBps,
    estimatedMinMins: input.estimatedMinMins,
    estimatedMaxMins: input.estimatedMaxMins,
    createdAt: now,
    expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
  };
}

export function isQuoteExpired(quote: { expiresAt: Date }, now: Date = new Date()): boolean {
  return quote.expiresAt.getTime() <= now.getTime();
}

/** Seconds left on a quote, floored at zero. Drives the countdown in the UI. */
export function quoteSecondsRemaining(quote: { expiresAt: Date }, now: Date = new Date()): number {
  return Math.max(0, Math.floor((quote.expiresAt.getTime() - now.getTime()) / 1000));
}
