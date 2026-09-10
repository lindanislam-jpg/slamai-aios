import { describe, expect, it } from "vitest";
import { Money } from "@/remit/money/money";
import { assessRisk, type RiskContext } from "@/remit/compliance/risk";

function context(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    sourceAmount: Money.fromDecimalString("300", "EUR"),
    kycStatus: "APPROVED",
    destCountryRiskBand: "LOW",
    transfersLast24h: 0,
    sentLast24hMinor: 0n,
    sentLast30dMinor: 0n,
    isFirstTransferToRecipient: false,
    accountAgeDays: 30,
    screeningHit: false,
    thresholds: {
      manualReviewThresholdMinor: 100_000n, // €1,000
      kycRequiredThresholdMinor: 0n,
      velocityCountPerDay: 5,
      dailyLimitMinor: 500_000n,
      monthlyLimitMinor: 1_500_000n,
    },
    ...overrides,
  };
}

describe("risk assessment", () => {
  it("lets an ordinary verified transfer through", () => {
    const result = assessRisk(context());
    expect(result.decision).toBe("NORMAL");
    expect(result.hardStop).toBeNull();
  });

  it("stops a screening hit outright rather than reviewing it", () => {
    const result = assessRisk(context({ screeningHit: true }));
    expect(result.hardStop?.code).toBe("SCREENING_HIT");
    expect(result.score).toBe(100);
  });

  it("stops a customer whose verification was rejected", () => {
    expect(assessRisk(context({ kycStatus: "REJECTED" })).hardStop?.code).toBe("KYC_REJECTED");
  });

  it("sends an unverified customer to review, never straight through", () => {
    const result = assessRisk(context({ kycStatus: "NOT_STARTED" }));
    expect(result.decision).toBe("REVIEW_REQUIRED");
    expect(result.signals.map((signal) => signal.code)).toContain("KYC_INCOMPLETE");
  });

  it("reviews a transfer at or above the high-value threshold", () => {
    const below = assessRisk(context({ sourceAmount: Money.fromDecimalString("999.99", "EUR") }));
    const at = assessRisk(context({ sourceAmount: Money.fromDecimalString("1000", "EUR") }));
    expect(below.decision).toBe("NORMAL");
    expect(at.decision).toBe("REVIEW_REQUIRED");
    expect(at.signals.map((signal) => signal.code)).toContain("HIGH_VALUE");
  });

  it("catches velocity", () => {
    const result = assessRisk(context({ transfersLast24h: 5 }));
    expect(result.decision).toBe("REVIEW_REQUIRED");
    expect(result.signals.map((signal) => signal.code)).toContain("VELOCITY");
  });

  it("blocks a transfer that would breach the 24-hour limit", () => {
    const result = assessRisk(
      context({
        sourceAmount: Money.fromDecimalString("300", "EUR"),
        sentLast24hMinor: 480_000n, // €4,800 already sent, €5,000 limit
      }),
    );
    expect(result.hardStop?.code).toBe("DAILY_LIMIT");
  });

  it("blocks a transfer that would breach the 30-day limit", () => {
    const result = assessRisk(context({ sentLast30dMinor: 1_499_000n }));
    expect(result.hardStop?.code).toBe("MONTHLY_LIMIT");
  });

  it("escalates a high-risk destination country", () => {
    const result = assessRisk(context({ destCountryRiskBand: "HIGH" }));
    expect(result.decision).toBe("REVIEW_REQUIRED");
  });

  it("accumulates minor signals into a review", () => {
    // Individually non-blocking: medium country (10) + new recipient (10) +
    // new account (15) = 35, still below the 50 review threshold.
    const moderate = assessRisk(
      context({
        destCountryRiskBand: "MEDIUM",
        isFirstTransferToRecipient: true,
        accountAgeDays: 0,
      }),
    );
    expect(moderate.score).toBe(35);
    expect(moderate.decision).toBe("NORMAL");

    // Add a blocking signal and it goes to a human.
    const escalated = assessRisk(
      context({
        destCountryRiskBand: "HIGH",
        isFirstTransferToRecipient: true,
        accountAgeDays: 0,
      }),
    );
    expect(escalated.decision).toBe("REVIEW_REQUIRED");
  });

  it("caps the score at 100", () => {
    const result = assessRisk(
      context({
        kycStatus: "NOT_STARTED",
        sourceAmount: Money.fromDecimalString("2000", "EUR"),
        transfersLast24h: 10,
        destCountryRiskBand: "HIGH",
        isFirstTransferToRecipient: true,
        accountAgeDays: 0,
      }),
    );
    expect(result.score).toBe(100);
  });
});
