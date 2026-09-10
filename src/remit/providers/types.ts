import type { Money } from "../money/money";
import type { Decimal } from "../money/money";

/**
 * Provider interfaces — the regulatory boundary of this system.
 *
 * This application is the customer-facing platform. It does NOT hold, transfer
 * or control customer money. Every movement of funds happens behind one of
 * these interfaces, implemented by a regulated payment institution, EMI, FX
 * provider or licensed payout partner.
 *
 * Sandbox implementations exist so the whole product can be demonstrated
 * without any real money moving. They are clearly labelled as sandbox in the
 * UI and can never be mistaken for a live integration.
 */

export interface ProviderInfo {
  key: string;
  displayName: string;
  /** false until real credentials and a real contract exist. */
  isLive: boolean;
  /** Shown in the admin UI, e.g. "Sandbox" or "Not yet connected". */
  statusLabel: string;
}

// ---------------------------------------------------------------------------
// Payment (collecting funds from the customer)
// ---------------------------------------------------------------------------

export type PaymentMethod =
  | "BANK_TRANSFER"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "APPLE_PAY"
  | "GOOGLE_PAY";

export interface CreatePaymentRequest {
  /** Our transfer reference — passed to the provider for reconciliation. */
  reference: string;
  amount: Money;
  method: PaymentMethod;
  /** Required: the provider must reject a replayed request, not us alone. */
  idempotencyKey: string;
  customer: { id: string; email: string; name: string };
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: "REQUIRES_ACTION" | "PENDING" | "SUCCEEDED" | "FAILED";
  /** Where to send the customer to authorise, when the method needs it. */
  redirectUrl?: string;
  /** Client-side token (never a secret key) for hosted payment elements. */
  clientSecret?: string;
  /** What the provider charges us to collect these funds. */
  providerFee?: Money;
  raw: unknown;
}

export interface PaymentProvider {
  readonly info: ProviderInfo;
  readonly supportedMethods: PaymentMethod[];
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;
  /**
   * Verify a webhook signature. Returning `null` means "reject" — a webhook is
   * never trusted on the strength of its body alone.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null;
}

// ---------------------------------------------------------------------------
// Payout (paying the recipient in the destination country)
// ---------------------------------------------------------------------------

export type PayoutMethod = "BANK_DEPOSIT" | "MOBILE_WALLET" | "CASH_PICKUP";

export interface CreatePayoutRequest {
  reference: string;
  amount: Money;
  method: PayoutMethod;
  idempotencyKey: string;
  destCountryCode: string;
  recipient: { fullName: string; details: Record<string, unknown> };
  metadata?: Record<string, string>;
}

export interface CreatePayoutResult {
  providerRef: string;
  status: "PENDING" | "SENT" | "PAID" | "FAILED";
  /** What the payout partner charges us to deliver these funds. */
  providerCost?: Money;
  estimatedDelivery?: Date;
  raw: unknown;
}

export interface PayoutProvider {
  readonly info: ProviderInfo;
  readonly supportedMethods: PayoutMethod[];
  createPayout(request: CreatePayoutRequest): Promise<CreatePayoutResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null;
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

export interface FxQuote {
  baseCurrency: string;
  quoteCurrency: string;
  /** Mid-market rate. Our margin is applied separately and disclosed. */
  marketRate: Decimal;
  fetchedAt: Date;
  provider: string;
}

export interface FXProvider {
  readonly info: ProviderInfo;
  getRate(baseCurrency: string, quoteCurrency: string): Promise<FxQuote>;
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export type KycStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export interface StartKycRequest {
  customerId: string;
  email: string;
  fullName: string;
  countryCode: string;
  level?: string;
  returnUrl: string;
}

export interface StartKycResult {
  providerRef: string;
  status: KycStatus;
  /** Hosted verification flow the customer is sent to. */
  verificationUrl?: string;
  raw: unknown;
}

export interface KYCProvider {
  readonly info: ProviderInfo;
  startVerification(request: StartKycRequest): Promise<StartKycResult>;
  getStatus(providerRef: string): Promise<{ status: KycStatus; reason?: string; raw: unknown }>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null;
}

// ---------------------------------------------------------------------------
// Sanctions / PEP screening
// ---------------------------------------------------------------------------

export interface ScreeningRequest {
  fullName: string;
  countryCode: string;
  role: "SENDER" | "RECIPIENT";
}

export interface ScreeningResult {
  hit: boolean;
  matches: { listName: string; matchedName: string; score: number }[];
  provider: string;
  screenedAt: Date;
}

export interface ScreeningProvider {
  readonly info: ProviderInfo;
  screen(request: ScreeningRequest): Promise<ScreeningResult>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationChannel = "EMAIL" | "SMS" | "PUSH";

export interface SendNotificationRequest {
  channel: NotificationChannel;
  destination: string;
  subject?: string;
  body: string;
  template: string;
  metadata?: Record<string, string>;
}

export interface SendNotificationResult {
  providerRef?: string;
  delivered: boolean;
  error?: string;
}

export interface NotificationProvider {
  readonly info: ProviderInfo;
  readonly supportedChannels: NotificationChannel[];
  send(request: SendNotificationRequest): Promise<SendNotificationResult>;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * A verified inbound webhook. `externalId` is stored with a unique constraint,
 * which is what makes webhook processing idempotent under provider retries.
 */
export interface WebhookEnvelope {
  provider: string;
  externalId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signatureVerified: true;
}

export class ProviderNotConfiguredError extends Error {
  constructor(kind: string, key: string) {
    super(
      `${kind} provider "${key}" is not connected. Configure its credentials, ` +
        `or set the provider to "sandbox" to run against the sandbox implementation.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
