import "server-only";
import { db } from "@/lib/db";
import { Money } from "../money/money";
import { settings } from "../config/settings";
import { assessRisk, type RiskAssessment } from "../compliance/risk";
import { getScreeningProvider } from "../providers/registry";
import type { RemitCorridor, RemitCustomer, RemitRecipient } from "@prisma/client";

/**
 * Compliance service — gathers the real facts about a customer and hands them
 * to the pure risk engine.
 *
 * There is deliberately no "skip checks" flag and no code path that reaches the
 * payment provider without passing through here.
 */

export interface ComplianceInput {
  customer: RemitCustomer;
  corridor: RemitCorridor & { destCountry: { riskBand: string } };
  recipient: RemitRecipient;
  sourceAmount: Money;
}

export async function assessTransfer(input: ComplianceInput): Promise<RiskAssessment> {
  const { customer, corridor, recipient, sourceAmount } = input;
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [last24h, last30d, priorToRecipient, screeningSender, screeningRecipient] =
    await Promise.all([
      db.remitTransfer.findMany({
        where: {
          customerId: customer.id,
          createdAt: { gte: dayAgo },
          status: { notIn: ["FAILED", "CANCELLED"] },
        },
        select: { sourceAmountMinor: true },
      }),
      db.remitTransfer.aggregate({
        where: {
          customerId: customer.id,
          createdAt: { gte: monthAgo },
          status: { notIn: ["FAILED", "CANCELLED"] },
        },
        _sum: { sourceAmountMinor: true },
      }),
      db.remitTransfer.count({
        where: { customerId: customer.id, recipientId: recipient.id },
      }),
      getScreeningProvider().screen({
        fullName: customer.fullName,
        countryCode: customer.countryCode,
        role: "SENDER",
      }),
      getScreeningProvider().screen({
        fullName: recipient.fullName,
        countryCode: recipient.destCountryCode,
        role: "RECIPIENT",
      }),
    ]);

  const sentLast24hMinor = last24h.reduce((total, row) => total + row.sourceAmountMinor, 0n);

  const assessment = assessRisk({
    sourceAmount,
    kycStatus: customer.kycStatus,
    destCountryRiskBand: corridor.destCountry.riskBand as "LOW" | "MEDIUM" | "HIGH",
    transfersLast24h: last24h.length,
    sentLast24hMinor,
    sentLast30dMinor: last30d._sum.sourceAmountMinor ?? 0n,
    isFirstTransferToRecipient: priorToRecipient === 0,
    accountAgeDays: Math.floor((now - customer.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    screeningHit: screeningSender.hit || screeningRecipient.hit,
    thresholds: {
      manualReviewThresholdMinor: settings.compliance.manualReviewThresholdMinor,
      kycRequiredThresholdMinor: settings.compliance.kycRequiredThresholdMinor,
      velocityCountPerDay: settings.compliance.velocityCountPerDay,
      dailyLimitMinor: corridor.dailyLimitMinor,
      monthlyLimitMinor: corridor.monthlyLimitMinor,
    },
  });

  // Keep the customer's rolling score current for the admin customer view.
  if (assessment.score !== customer.riskScore) {
    await db.remitCustomer.update({
      where: { id: customer.id },
      data: { riskScore: assessment.score },
    });
  }

  return assessment;
}
