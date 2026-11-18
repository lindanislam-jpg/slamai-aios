import "server-only";
import { db } from "@/lib/db";
import { Money } from "../money/money";
import { settings } from "../config/settings";
import { calculateQuote } from "../quotes/quote-calculator";
import { getFxProvider } from "../providers/registry";
import { badRequest, notFound } from "./api";
import type { FeeRule } from "../fees/fee-engine";
import type { Prisma, RemitCorridor, RemitCountry, RemitQuote } from "@prisma/client";

export type CorridorWithCountries = RemitCorridor & {
  sourceCountry: RemitCountry;
  destCountry: RemitCountry;
  paymentOptions: { method: string; isEnabled: boolean; sortOrder: number }[];
  payoutOptions: { method: string; isEnabled: boolean; sortOrder: number }[];
};

export async function findCorridor(
  sourceCountryCode: string,
  destCountryCode: string,
): Promise<CorridorWithCountries> {
  const corridor = await db.remitCorridor.findUnique({
    where: { sourceCountryCode_destCountryCode: { sourceCountryCode, destCountryCode } },
    include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
  });
  if (!corridor || !corridor.isActive) {
    throw notFound(`We do not support ${sourceCountryCode} to ${destCountryCode} yet`);
  }
  return corridor;
}

export async function loadFeeRules(corridorId: string): Promise<FeeRule[]> {
  const rules = await db.remitFeeRule.findMany({
    where: {
      isActive: true,
      OR: [{ corridorId }, { corridorId: null }],
    },
  });
  return rules.map((rule) => ({ ...rule }));
}

export interface CreateQuoteInput {
  customerId: string;
  sourceCountryCode: string;
  destCountryCode: string;
  /** Decimal string, e.g. "300" or "300.50". Parsed server-side. */
  sourceAmount: string;
  paymentMethod: string;
  payoutMethod: string;
  segment?: string | null;
  promoCode?: string | null;
}

export interface CreatedQuote {
  quote: RemitQuote;
  corridor: CorridorWithCountries;
}

/**
 * Create a priced quote.
 *
 * Everything is computed server-side from the corridor configuration, the
 * configured fee rules and a rate fetched from the FX provider. The client's
 * only inputs are the corridor, the amount and the methods — never a fee, a
 * rate or a recipient amount.
 */
export async function createQuote(input: CreateQuoteInput): Promise<CreatedQuote> {
  const corridor = await findCorridor(input.sourceCountryCode, input.destCountryCode);

  assertMethodEnabled(corridor.paymentOptions, input.paymentMethod, "payment");
  assertMethodEnabled(corridor.payoutOptions, input.payoutMethod, "payout");

  let sourceAmount: Money;
  try {
    sourceAmount = Money.fromDecimalString(input.sourceAmount, corridor.sourceCurrency);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid amount");
  }

  const fxProvider = getFxProvider(corridor.fxProviderKey);
  const rate = await fxProvider.getRate(corridor.sourceCurrency, corridor.destCurrency);

  // Log every observed rate. Quotes snapshot the rate they used, so this is a
  // record of what the provider said, not the source of truth for a transfer.
  await db.remitExchangeRate.create({
    data: {
      baseCurrency: rate.baseCurrency,
      quoteCurrency: rate.quoteCurrency,
      marketRate: rate.marketRate.toString(),
      provider: rate.provider,
      fetchedAt: rate.fetchedAt,
    },
  });

  const calculation = calculateQuote({
    corridorId: corridor.id,
    sourceAmount,
    destCurrency: corridor.destCurrency,
    marketRate: rate.marketRate,
    fxMarginBps: corridor.fxMarginBps,
    feeRules: await loadFeeRules(corridor.id),
    segment: input.segment,
    promoCode: input.promoCode,
    minAmountMinor: corridor.minAmountMinor,
    maxAmountMinor: corridor.maxAmountMinor,
    estimatedMinMins: corridor.estimatedMinMins,
    estimatedMaxMins: corridor.estimatedMaxMins,
    ttlSeconds: settings.quoteTtlSeconds,
  });

  const quote = await db.remitQuote.create({
    data: {
      customerId: input.customerId,
      corridorId: corridor.id,
      sourceCurrency: corridor.sourceCurrency,
      destCurrency: corridor.destCurrency,
      sourceAmountMinor: calculation.sourceAmount.minor,
      feeMinor: calculation.fee.minor,
      feeRuleId: calculation.feeRuleId,
      marketRate: calculation.marketRate.toString(),
      customerRate: calculation.customerRate.toString(),
      fxMarginBps: calculation.fxMarginBps,
      destAmountMinor: calculation.destAmount.minor,
      totalPayableMinor: calculation.totalPayable.minor,
      paymentMethod: input.paymentMethod as Prisma.RemitQuoteCreateInput["paymentMethod"],
      payoutMethod: input.payoutMethod as Prisma.RemitQuoteCreateInput["payoutMethod"],
      estimatedMinMins: calculation.estimatedMinMins,
      estimatedMaxMins: calculation.estimatedMaxMins,
      expiresAt: calculation.expiresAt,
    },
  });

  return { quote, corridor };
}

function assertMethodEnabled(
  options: { method: string; isEnabled: boolean }[],
  method: string,
  kind: "payment" | "payout",
): void {
  const option = options.find((candidate) => candidate.method === method);
  if (!option?.isEnabled) {
    throw badRequest(`That ${kind} method is not available on this route yet`);
  }
}
