import { describe, expect, it } from "vitest";
import { Money } from "@/remit/money/money";
import { calculateFee, NoFeeRuleError, selectFeeRule, type FeeRule } from "@/remit/fees/fee-engine";
import { fxMarginRevenue, priceRate } from "@/remit/fx/pricing";
import {
  AmountOutOfRangeError,
  calculateQuote,
  isQuoteExpired,
  quoteSecondsRemaining,
} from "@/remit/quotes/quote-calculator";

const CORRIDOR = "corridor-ie-za";

function rule(overrides: Partial<FeeRule> = {}): FeeRule {
  return {
    id: "rule-standard",
    name: "Standard €5 transfer fee",
    corridorId: null,
    segment: null,
    promoCode: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    fixedFeeMinor: 500n,
    percentageBps: 0,
    currency: "EUR",
    priority: 0,
    isActive: true,
    effectiveFrom: new Date("2020-01-01"),
    effectiveTo: null,
    ...overrides,
  };
}

describe("fee engine", () => {
  it("charges exactly €5 on the standard rule", () => {
    const { fee } = calculateFee([rule()], {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    expect(fee.toDecimalString()).toBe("5.00");
  });

  it("charges the same €5 whatever the amount", () => {
    for (const amount of ["10", "300", "1000", "4999.99"]) {
      const { fee } = calculateFee([rule()], {
        corridorId: CORRIDOR,
        sourceAmount: Money.fromDecimalString(amount, "EUR"),
      });
      expect(fee.toDecimalString()).toBe("5.00");
    }
  });

  it("fails closed when no rule matches rather than quoting zero", () => {
    expect(() =>
      calculateFee([], { corridorId: CORRIDOR, sourceAmount: Money.fromDecimalString("300", "EUR") }),
    ).toThrow(NoFeeRuleError);
  });

  it("applies a promo rule only when its code is supplied", () => {
    const rules = [
      rule(),
      rule({ id: "promo", name: "Free", promoCode: "FIRSTFREE", fixedFeeMinor: 0n, priority: 100 }),
    ];

    const without = calculateFee(rules, {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    expect(without.fee.toDecimalString()).toBe("5.00");

    const withCode = calculateFee(rules, {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
      promoCode: "FIRSTFREE",
    });
    expect(withCode.fee.toDecimalString()).toBe("0.00");
    expect(withCode.rule?.id).toBe("promo");
  });

  it("falls back to standard pricing when an unknown promo code is used", () => {
    const { fee } = calculateFee([rule()], {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
      promoCode: "NOTAREALCODE",
    });
    expect(fee.toDecimalString()).toBe("5.00");
  });

  it("prefers a corridor-specific rule over a global one at equal priority", () => {
    const chosen = selectFeeRule(
      [rule(), rule({ id: "corridor", corridorId: CORRIDOR, fixedFeeMinor: 300n })],
      { corridorId: CORRIDOR, sourceAmount: Money.fromDecimalString("300", "EUR") },
    );
    expect(chosen?.id).toBe("corridor");
  });

  it("honours high-value amount bands", () => {
    const rules = [
      rule(),
      rule({ id: "high-value", minAmountMinor: 200_000n, fixedFeeMinor: 1500n, priority: 10 }),
    ];
    const small = calculateFee(rules, {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    const large = calculateFee(rules, {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("2500", "EUR"),
    });
    expect(small.fee.toDecimalString()).toBe("5.00");
    expect(large.fee.toDecimalString()).toBe("15.00");
  });

  it("never stacks two matching rules", () => {
    const { fee } = calculateFee([rule(), rule({ id: "second", fixedFeeMinor: 900n })], {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    expect([500n, 900n]).toContain(fee.minor);
  });

  it("ignores inactive and expired rules", () => {
    const chosen = selectFeeRule(
      [
        rule({ id: "off", isActive: false, fixedFeeMinor: 0n, priority: 50 }),
        rule({ id: "ended", effectiveTo: new Date("2021-01-01"), fixedFeeMinor: 0n, priority: 50 }),
        rule(),
      ],
      { corridorId: CORRIDOR, sourceAmount: Money.fromDecimalString("300", "EUR") },
    );
    expect(chosen?.id).toBe("rule-standard");
  });

  it("computes a percentage component exactly", () => {
    const { fee } = calculateFee([rule({ fixedFeeMinor: 0n, percentageBps: 50 })], {
      corridorId: CORRIDOR,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    expect(fee.toDecimalString()).toBe("1.50");
  });
});

describe("FX pricing", () => {
  it("gives the customer the market rate when the margin is zero", () => {
    const priced = priceRate("19.85", 0);
    expect(priced.customerRate.toString()).toBe("19.85");
    expect(priced.marketRate.toString()).toBe("19.85");
  });

  it("applies a margin in basis points and keeps the market rate separate", () => {
    const priced = priceRate("20", 50); // 0.5%
    expect(priced.marketRate.toString()).toBe("20");
    expect(priced.customerRate.toString()).toBe("19.9");
  });

  it("rejects a nonsensical rate or margin", () => {
    expect(() => priceRate("0", 0)).toThrow();
    expect(() => priceRate("-1", 0)).toThrow();
    expect(() => priceRate("20", -5)).toThrow();
    expect(() => priceRate("20", 10_001)).toThrow();
  });

  it("reports FX margin revenue separately from the fee", () => {
    expect(fxMarginRevenue(Money.fromDecimalString("300", "EUR"), 0).toDecimalString()).toBe("0.00");
    expect(fxMarginRevenue(Money.fromDecimalString("300", "EUR"), 50).toDecimalString()).toBe("1.50");
  });
});

describe("quote calculation", () => {
  const base = {
    corridorId: CORRIDOR,
    destCurrency: "ZAR",
    marketRate: "19.85",
    fxMarginBps: 0,
    feeRules: [rule()],
    minAmountMinor: 1_000n,
    maxAmountMinor: 500_000n,
    estimatedMinMins: 60,
    estimatedMaxMins: 1440,
    ttlSeconds: 900,
  };

  it("produces the exact numbers from the brief: €300 -> €5 fee -> €305 total", () => {
    const quote = calculateQuote({ ...base, sourceAmount: Money.fromDecimalString("300", "EUR") });

    expect(quote.sourceAmount.toDecimalString()).toBe("300.00");
    expect(quote.fee.toDecimalString()).toBe("5.00");
    expect(quote.totalPayable.toDecimalString()).toBe("305.00");
    expect(quote.destAmount.currency).toBe("ZAR");
    expect(quote.destAmount.toDecimalString()).toBe("5955.00");
  });

  it("calculates the recipient amount from the send amount, not the total", () => {
    // The fee is charged on top. If it were deducted, the recipient would get
    // 295 EUR worth instead of 300.
    const quote = calculateQuote({ ...base, sourceAmount: Money.fromDecimalString("300", "EUR") });
    const feeInZar = Money.fromDecimalString("5", "EUR").convert("19.85", "ZAR");
    expect(quote.destAmount.minor).toBeGreaterThan(
      Money.fromDecimalString("5955.00", "ZAR").subtract(feeInZar).minor,
    );
  });

  it("total always equals amount plus fee", () => {
    for (const amount of ["10", "300", "1234.56", "5000"]) {
      const quote = calculateQuote({ ...base, sourceAmount: Money.fromDecimalString(amount, "EUR") });
      expect(quote.totalPayable.equals(quote.sourceAmount.add(quote.fee))).toBe(true);
    }
  });

  it("rejects amounts below the corridor minimum", () => {
    expect(() =>
      calculateQuote({ ...base, sourceAmount: Money.fromDecimalString("5", "EUR") }),
    ).toThrow(AmountOutOfRangeError);
  });

  it("rejects amounts above the corridor maximum", () => {
    expect(() =>
      calculateQuote({ ...base, sourceAmount: Money.fromDecimalString("6000", "EUR") }),
    ).toThrow(AmountOutOfRangeError);
  });

  it("rejects a zero amount", () => {
    expect(() =>
      calculateQuote({ ...base, sourceAmount: Money.fromDecimalString("0", "EUR") }),
    ).toThrow();
  });

  it("expires after the configured TTL and not before", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const quote = calculateQuote({
      ...base,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
      now,
    });

    expect(quote.expiresAt.toISOString()).toBe("2026-01-01T12:15:00.000Z");
    expect(isQuoteExpired(quote, new Date("2026-01-01T12:14:59Z"))).toBe(false);
    expect(isQuoteExpired(quote, new Date("2026-01-01T12:15:00Z"))).toBe(true);
    expect(quoteSecondsRemaining(quote, new Date("2026-01-01T12:14:00Z"))).toBe(60);
    expect(quoteSecondsRemaining(quote, new Date("2026-01-01T12:30:00Z"))).toBe(0);
  });

  it("keeps market rate, customer rate, margin and fee as four separate figures", () => {
    const quote = calculateQuote({
      ...base,
      fxMarginBps: 50,
      sourceAmount: Money.fromDecimalString("300", "EUR"),
    });
    expect(quote.marketRate.toString()).toBe("19.85");
    expect(quote.customerRate.toString()).not.toBe(quote.marketRate.toString());
    expect(quote.fxMarginBps).toBe(50);
    expect(quote.fee.toDecimalString()).toBe("5.00");
  });
});
