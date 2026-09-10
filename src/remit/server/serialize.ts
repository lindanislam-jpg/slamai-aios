import { Money, type MoneyDTO } from "../money/money";
import { buildTimeline, type TransferStatus } from "../transfers/status";
import { quoteSecondsRemaining } from "../quotes/quote-calculator";
import { redactRecipientDetails } from "../corridors/recipient-schema";
import type {
  Prisma,
  RemitCorridor,
  RemitCountry,
  RemitQuote,
  RemitRecipient,
  RemitTransfer,
  RemitTransferEvent,
} from "@prisma/client";

/**
 * Database rows -> API responses.
 *
 * Two rules enforced here:
 *  1. BigInt minor units never leave as numbers. They go out as `MoneyDTO`, so
 *     no client can round-trip an amount through a float.
 *  2. Only fields a client is entitled to see are copied. Provider payloads,
 *     internal cost figures and raw risk data stay server-side.
 */

export function money(minor: bigint, currency: string): MoneyDTO {
  return Money.fromMinor(minor, currency).toJSON();
}

export interface QuoteDTO {
  id: string;
  corridorId: string;
  sourceCurrency: string;
  destCurrency: string;
  sourceAmount: MoneyDTO;
  fee: MoneyDTO;
  totalPayable: MoneyDTO;
  destAmount: MoneyDTO;
  marketRate: string;
  customerRate: string;
  fxMarginBps: number;
  /** Human-readable rate line, e.g. "€1 = R19.85". */
  rateDisplay: string;
  paymentMethod: string;
  payoutMethod: string;
  estimatedDelivery: string;
  estimatedMinMins: number;
  estimatedMaxMins: number;
  status: string;
  expiresAt: string;
  secondsRemaining: number;
  isSandbox: boolean;
}

export function serializeQuote(
  quote: RemitQuote,
  corridor: Pick<RemitCorridor, "isLive">,
  now = new Date(),
): QuoteDTO {
  return {
    id: quote.id,
    corridorId: quote.corridorId,
    sourceCurrency: quote.sourceCurrency,
    destCurrency: quote.destCurrency,
    sourceAmount: money(quote.sourceAmountMinor, quote.sourceCurrency),
    fee: money(quote.feeMinor, quote.sourceCurrency),
    totalPayable: money(quote.totalPayableMinor, quote.sourceCurrency),
    destAmount: money(quote.destAmountMinor, quote.destCurrency),
    marketRate: quote.marketRate.toString(),
    customerRate: quote.customerRate.toString(),
    fxMarginBps: quote.fxMarginBps,
    rateDisplay: formatRateDisplay(quote.sourceCurrency, quote.destCurrency, quote.customerRate),
    paymentMethod: quote.paymentMethod,
    payoutMethod: quote.payoutMethod,
    estimatedDelivery: formatDeliveryEstimate(quote.estimatedMinMins, quote.estimatedMaxMins),
    estimatedMinMins: quote.estimatedMinMins,
    estimatedMaxMins: quote.estimatedMaxMins,
    status: quote.status,
    expiresAt: quote.expiresAt.toISOString(),
    secondsRemaining: quoteSecondsRemaining(quote, now),
    isSandbox: !corridor.isLive,
  };
}

export interface RecipientDTO {
  id: string;
  nickname: string | null;
  fullName: string;
  destCountryCode: string;
  destCurrency: string;
  payoutMethod: string;
  /** Sensitive fields masked, e.g. account number as "*******1234". */
  maskedDetails: Record<string, unknown>;
  createdAt: string;
}

export function serializeRecipient(recipient: RemitRecipient): RecipientDTO {
  return {
    id: recipient.id,
    nickname: recipient.nickname,
    fullName: recipient.fullName,
    destCountryCode: recipient.destCountryCode,
    destCurrency: recipient.destCurrency,
    payoutMethod: recipient.payoutMethod,
    maskedDetails: redactRecipientDetails(
      recipient.destCountryCode,
      recipient.payoutMethod,
      (recipient.details ?? {}) as Record<string, unknown>,
    ),
    createdAt: recipient.createdAt.toISOString(),
  };
}

export interface TransferDTO {
  id: string;
  reference: string;
  status: TransferStatus;
  statusLabel: string;
  complianceStatus: string;
  sourceAmount: MoneyDTO;
  fee: MoneyDTO;
  totalPayable: MoneyDTO;
  destAmount: MoneyDTO;
  customerRate: string;
  marketRate: string;
  fxMarginBps: number;
  rateDisplay: string;
  paymentMethod: string;
  payoutMethod: string;
  recipient: { id: string; fullName: string; destCountryCode: string } | null;
  isDemo: boolean;
  isSandbox: boolean;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  timeline?: {
    key: string;
    label: string;
    description: string;
    state: string;
    at: string | null;
  }[];
  canCancel?: boolean;
}

type TransferWithRelations = RemitTransfer & {
  recipient?: RemitRecipient | null;
  corridor?: Pick<RemitCorridor, "isLive"> | null;
  events?: RemitTransferEvent[];
};

export function serializeTransfer(
  transfer: TransferWithRelations,
  options: { includeTimeline?: boolean } = {},
): TransferDTO {
  const status = transfer.status as TransferStatus;
  const dto: TransferDTO = {
    id: transfer.id,
    reference: transfer.reference,
    status,
    statusLabel: STATUS_LABEL[status],
    complianceStatus: transfer.complianceStatus,
    sourceAmount: money(transfer.sourceAmountMinor, transfer.sourceCurrency),
    fee: money(transfer.feeMinor, transfer.sourceCurrency),
    totalPayable: money(transfer.totalPayableMinor, transfer.sourceCurrency),
    destAmount: money(transfer.destAmountMinor, transfer.destCurrency),
    customerRate: transfer.customerRate.toString(),
    marketRate: transfer.marketRate.toString(),
    fxMarginBps: transfer.fxMarginBps,
    rateDisplay: formatRateDisplay(
      transfer.sourceCurrency,
      transfer.destCurrency,
      transfer.customerRate,
    ),
    paymentMethod: transfer.paymentMethod,
    payoutMethod: transfer.payoutMethod,
    recipient: transfer.recipient
      ? {
          id: transfer.recipient.id,
          fullName: transfer.recipient.fullName,
          destCountryCode: transfer.recipient.destCountryCode,
        }
      : null,
    isDemo: transfer.isDemo,
    isSandbox: transfer.corridor ? !transfer.corridor.isLive : true,
    failureReason: transfer.failureReason,
    createdAt: transfer.createdAt.toISOString(),
    completedAt: transfer.completedAt?.toISOString() ?? null,
  };

  if (options.includeTimeline && transfer.events) {
    dto.timeline = buildTimeline(
      status,
      transfer.events.map((event) => ({
        toStatus: event.toStatus as TransferStatus,
        createdAt: event.createdAt,
      })),
    ).map((entry) => ({
      key: entry.key,
      label: entry.label,
      description: entry.description,
      state: entry.state,
      at: entry.at?.toISOString() ?? null,
    }));
  }

  return dto;
}

export interface CorridorDTO {
  id: string;
  source: { countryCode: string; name: string; flag: string; currency: string };
  destination: { countryCode: string; name: string; flag: string; currency: string };
  minAmount: MoneyDTO;
  maxAmount: MoneyDTO;
  fxMarginBps: number;
  estimatedDelivery: string;
  paymentMethods: string[];
  payoutMethods: string[];
  isLive: boolean;
  /** UI badge: "Sandbox" until real providers are connected. */
  statusLabel: string;
}

type CorridorWithRelations = RemitCorridor & {
  sourceCountry: RemitCountry;
  destCountry: RemitCountry;
  paymentOptions: { method: string; isEnabled: boolean; sortOrder: number }[];
  payoutOptions: { method: string; isEnabled: boolean; sortOrder: number }[];
};

export function serializeCorridor(corridor: CorridorWithRelations): CorridorDTO {
  return {
    id: corridor.id,
    source: {
      countryCode: corridor.sourceCountryCode,
      name: corridor.sourceCountry.name,
      flag: corridor.sourceCountry.flagEmoji,
      currency: corridor.sourceCurrency,
    },
    destination: {
      countryCode: corridor.destCountryCode,
      name: corridor.destCountry.name,
      flag: corridor.destCountry.flagEmoji,
      currency: corridor.destCurrency,
    },
    minAmount: money(corridor.minAmountMinor, corridor.sourceCurrency),
    maxAmount: money(corridor.maxAmountMinor, corridor.sourceCurrency),
    fxMarginBps: corridor.fxMarginBps,
    estimatedDelivery: formatDeliveryEstimate(corridor.estimatedMinMins, corridor.estimatedMaxMins),
    paymentMethods: corridor.paymentOptions
      .filter((option) => option.isEnabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((option) => option.method),
    payoutMethods: corridor.payoutOptions
      .filter((option) => option.isEnabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((option) => option.method),
    isLive: corridor.isLive,
    statusLabel: corridor.isLive ? "Live" : "Sandbox",
  };
}

// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAYMENT_RECEIVED: "Payment received",
  COMPLIANCE_REVIEW: "In review",
  CONVERTING: "Converting",
  SENT: "Sent",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function formatRateDisplay(
  sourceCurrency: string,
  destCurrency: string,
  rate: Prisma.Decimal | string,
): string {
  const one = Money.fromMinor(100n, sourceCurrency);
  const converted = one.convert(rate.toString(), destCurrency);
  return `${one.format()} = ${converted.format()}`;
}

export function formatDeliveryEstimate(minMins: number, maxMins: number): string {
  if (maxMins <= 60) return "Within the hour";
  if (maxMins <= 24 * 60) return minMins <= 60 ? "Same day" : "Within 24 hours";
  const days = Math.round(maxMins / (24 * 60));
  return `1-${days} business days`;
}
