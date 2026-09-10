import { Money } from "../money/money";

/**
 * Risk scoring and the compliance decision.
 *
 * This is a *hook*, not a compliance programme. It decides when a transfer
 * pauses for a human; it does not make the business compliant with AML law.
 * Real screening, monitoring and reporting belong with the regulated provider
 * and a compliance officer. Nothing here is designed to be bypassable — there
 * is no code path that skips these checks.
 */

export type ComplianceDecision = "NORMAL" | "REVIEW_REQUIRED";

export interface RiskSignal {
  code: string;
  description: string;
  /** Points added to the transfer's risk score (0-100 overall). */
  weight: number;
  /** True if this signal alone forces a human review. */
  blocking: boolean;
}

export interface RiskContext {
  sourceAmount: Money;
  /** Customer's KYC state at the time of the transfer. */
  kycStatus: "NOT_STARTED" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  /** Destination country risk band, from the country catalogue. */
  destCountryRiskBand: "LOW" | "MEDIUM" | "HIGH";
  /** Transfers this customer has created in the last 24 hours. */
  transfersLast24h: number;
  /** Total sent in the last 24 hours, source currency minor units. */
  sentLast24hMinor: bigint;
  /** Total sent in the last 30 days, source currency minor units. */
  sentLast30dMinor: bigint;
  /** True when this is the first transfer to this recipient. */
  isFirstTransferToRecipient: boolean;
  /** Days since the customer account was created. */
  accountAgeDays: number;
  /** Result of the sanctions/PEP screen for sender and recipient. */
  screeningHit: boolean;
  thresholds: {
    manualReviewThresholdMinor: bigint;
    kycRequiredThresholdMinor: bigint;
    velocityCountPerDay: number;
    dailyLimitMinor: bigint;
    monthlyLimitMinor: bigint;
  };
}

export interface RiskAssessment {
  score: number;
  decision: ComplianceDecision;
  signals: RiskSignal[];
  /** Set when the transfer must be refused outright rather than reviewed. */
  hardStop: { code: string; reason: string } | null;
}

export function assessRisk(context: RiskContext): RiskAssessment {
  const signals: RiskSignal[] = [];
  const { thresholds, sourceAmount } = context;
  const amount = sourceAmount.minor;

  // --- Hard stops: the transfer cannot proceed at all. -----------------------
  if (context.screeningHit) {
    return {
      score: 100,
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "SCREENING_HIT",
          description: "Sanctions or PEP screening returned a potential match",
          weight: 100,
          blocking: true,
        },
      ],
      hardStop: {
        code: "SCREENING_HIT",
        reason: "Screening match — this transfer requires manual compliance clearance",
      },
    };
  }

  if (context.kycStatus === "REJECTED") {
    return {
      score: 100,
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "KYC_REJECTED",
          description: "Customer verification was rejected",
          weight: 100,
          blocking: true,
        },
      ],
      hardStop: { code: "KYC_REJECTED", reason: "Identity verification was not successful" },
    };
  }

  if (amount + context.sentLast24hMinor > thresholds.dailyLimitMinor) {
    return {
      score: 90,
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "DAILY_LIMIT",
          description: "Transfer would exceed the corridor's 24-hour limit",
          weight: 90,
          blocking: true,
        },
      ],
      hardStop: { code: "DAILY_LIMIT", reason: "This would exceed your 24-hour sending limit" },
    };
  }

  if (amount + context.sentLast30dMinor > thresholds.monthlyLimitMinor) {
    return {
      score: 90,
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "MONTHLY_LIMIT",
          description: "Transfer would exceed the corridor's 30-day limit",
          weight: 90,
          blocking: true,
        },
      ],
      hardStop: { code: "MONTHLY_LIMIT", reason: "This would exceed your 30-day sending limit" },
    };
  }

  // --- Scored signals -------------------------------------------------------
  if (amount >= thresholds.manualReviewThresholdMinor) {
    signals.push({
      code: "HIGH_VALUE",
      description: `Transfer of ${sourceAmount.format()} is at or above the manual review threshold`,
      weight: 40,
      blocking: true,
    });
  }

  if (
    amount >= thresholds.kycRequiredThresholdMinor &&
    context.kycStatus !== "APPROVED"
  ) {
    signals.push({
      code: "KYC_INCOMPLETE",
      description: "Customer verification is not complete for this amount",
      weight: 50,
      blocking: true,
    });
  }

  if (context.transfersLast24h >= thresholds.velocityCountPerDay) {
    signals.push({
      code: "VELOCITY",
      description: `${context.transfersLast24h} transfers in the last 24 hours`,
      weight: 30,
      blocking: true,
    });
  }

  if (context.destCountryRiskBand === "HIGH") {
    signals.push({
      code: "COUNTRY_RISK_HIGH",
      description: "Destination country is in the high-risk band",
      weight: 30,
      blocking: true,
    });
  } else if (context.destCountryRiskBand === "MEDIUM") {
    signals.push({
      code: "COUNTRY_RISK_MEDIUM",
      description: "Destination country is in the medium-risk band",
      weight: 10,
      blocking: false,
    });
  }

  if (context.isFirstTransferToRecipient) {
    signals.push({
      code: "NEW_RECIPIENT",
      description: "First transfer to this recipient",
      weight: 10,
      blocking: false,
    });
  }

  if (context.accountAgeDays < 1) {
    signals.push({
      code: "NEW_ACCOUNT",
      description: "Account created less than 24 hours ago",
      weight: 15,
      blocking: false,
    });
  }

  const score = Math.min(
    100,
    signals.reduce((total, signal) => total + signal.weight, 0),
  );

  // Either a single blocking signal or a high cumulative score sends it to a
  // human. Both paths exist so a pile of individually-minor signals still gets
  // looked at.
  const decision: ComplianceDecision =
    signals.some((signal) => signal.blocking) || score >= 50 ? "REVIEW_REQUIRED" : "NORMAL";

  return { score, decision, signals, hardStop: null };
}
