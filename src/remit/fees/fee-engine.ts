import { Money } from "../money/money";

/**
 * Fee engine.
 *
 * The €5 fee is data, not code: it lives in `remit_fee_rules` and is resolved
 * here at quote time. Promotional (€0), business, high-value and
 * corridor-specific pricing are all expressible as additional rows — no code
 * change required.
 */

export interface FeeRule {
  id: string;
  name: string;
  corridorId: string | null;
  segment: string | null;
  promoCode: string | null;
  minAmountMinor: bigint | null;
  maxAmountMinor: bigint | null;
  fixedFeeMinor: bigint;
  percentageBps: number;
  currency: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface FeeContext {
  corridorId: string;
  sourceAmount: Money;
  /** Customer segment, e.g. "personal" | "business". */
  segment?: string | null;
  promoCode?: string | null;
  at?: Date;
}

export interface FeeResult {
  fee: Money;
  rule: FeeRule | null;
}

/**
 * Pick the single rule that applies, then compute the fee.
 *
 * Selection order: highest `priority`, then most specific (corridor-scoped
 * beats global), then most recently effective. Exactly one rule ever applies —
 * fees are never stacked, so the customer-facing number is always the number.
 */
export function selectFeeRule(rules: FeeRule[], context: FeeContext): FeeRule | null {
  const at = context.at ?? new Date();
  const amount = context.sourceAmount.minor;

  const candidates = rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.currency !== context.sourceAmount.currency) return false;
    if (rule.effectiveFrom > at) return false;
    if (rule.effectiveTo && rule.effectiveTo <= at) return false;
    if (rule.corridorId && rule.corridorId !== context.corridorId) return false;
    if (rule.segment && rule.segment !== (context.segment ?? "personal")) return false;
    // A promo rule only applies when that exact code was supplied.
    if (rule.promoCode && rule.promoCode !== context.promoCode) return false;
    if (!rule.promoCode && context.promoCode) {
      // Non-promo rules stay eligible so a bad code falls back to standard
      // pricing rather than erroring the customer out of a quote.
    }
    if (rule.minAmountMinor !== null && amount < rule.minAmountMinor) return false;
    if (rule.maxAmountMinor !== null && amount > rule.maxAmountMinor) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aSpecific = specificity(a);
    const bSpecific = specificity(b);
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });

  return candidates[0];
}

function specificity(rule: FeeRule): number {
  let score = 0;
  if (rule.promoCode) score += 4;
  if (rule.corridorId) score += 2;
  if (rule.segment) score += 1;
  return score;
}

/**
 * Compute the fee for a transfer. A rule may charge a fixed amount, a
 * percentage, or both; percentage components round half-up to the cent.
 */
export function calculateFee(rules: FeeRule[], context: FeeContext): FeeResult {
  const rule = selectFeeRule(rules, context);
  const currency = context.sourceAmount.currency;

  if (!rule) {
    // No configured rule means we cannot price the transfer. Failing closed is
    // the only safe option — quoting €0 by accident would be a real loss.
    throw new NoFeeRuleError(context.corridorId, currency);
  }

  let fee = Money.fromMinor(rule.fixedFeeMinor, currency);
  if (rule.percentageBps > 0) {
    const variable = context.sourceAmount.multiply(rule.percentageBps / 10_000);
    fee = fee.add(variable);
  }

  return { fee, rule };
}

export class NoFeeRuleError extends Error {
  constructor(corridorId: string, currency: string) {
    super(
      `No active fee rule matches corridor ${corridorId} in ${currency}. ` +
        `Configure one in the admin fee settings before quoting.`,
    );
    this.name = "NoFeeRuleError";
  }
}
