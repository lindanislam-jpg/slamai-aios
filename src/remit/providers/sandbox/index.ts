import crypto from "crypto";
import { Money, RateDecimal } from "../../money/money";
import { settings } from "../../config/settings";
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  CreatePayoutRequest,
  CreatePayoutResult,
  FXProvider,
  FxQuote,
  KYCProvider,
  NotificationProvider,
  PaymentProvider,
  PayoutProvider,
  ProviderInfo,
  ScreeningProvider,
  ScreeningRequest,
  ScreeningResult,
  SendNotificationRequest,
  SendNotificationResult,
  StartKycRequest,
  StartKycResult,
  WebhookEnvelope,
} from "../types";

/**
 * Sandbox providers.
 *
 * These implement the real interfaces and follow the real code paths — the
 * transfer engine cannot tell them apart from a live provider — but no money
 * moves and no external call is made. Everything they produce is marked
 * sandbox, and the UI surfaces that badge wherever their output is shown.
 */

function sandboxInfo(key: string, displayName: string): ProviderInfo {
  return { key, displayName, isLive: false, statusLabel: "Sandbox" };
}

function sandboxRef(prefix: string): string {
  return `sbx_${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export class SandboxPaymentProvider implements PaymentProvider {
  readonly info = sandboxInfo("sandbox", "Sandbox payment provider");
  readonly supportedMethods: PaymentProvider["supportedMethods"] = ["BANK_TRANSFER", "DEBIT_CARD"];

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    // A sandbox collection charge, so gross margin reporting has a realistic
    // cost to work with rather than assuming the fee is all profit.
    const providerFee = request.method === "BANK_TRANSFER"
      ? Money.fromMinor(25n, request.amount.currency)
      : request.amount.multiply(0.014).add(Money.fromMinor(25n, request.amount.currency));

    return {
      providerRef: sandboxRef("pay"),
      status: "PENDING",
      providerFee,
      raw: {
        sandbox: true,
        note: "No money moved. Sandbox payment provider.",
        reference: request.reference,
        idempotencyKey: request.idempotencyKey,
        method: request.method,
        amount: request.amount.toJSON(),
      },
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null {
    return verifySharedSecretWebhook("sandbox-payment", rawBody, headers);
  }
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

export class SandboxPayoutProvider implements PayoutProvider {
  readonly info = sandboxInfo("sandbox", "Sandbox payout partner");
  readonly supportedMethods: PayoutProvider["supportedMethods"] = ["BANK_DEPOSIT"];

  async createPayout(request: CreatePayoutRequest): Promise<CreatePayoutResult> {
    return {
      providerRef: sandboxRef("out"),
      status: "SENT",
      // A flat sandbox delivery cost in the destination currency.
      providerCost: Money.fromMinor(1500n, request.amount.currency),
      estimatedDelivery: new Date(Date.now() + 60 * 60 * 1000),
      raw: {
        sandbox: true,
        note: "No money moved. Sandbox payout partner.",
        reference: request.reference,
        destCountryCode: request.destCountryCode,
        method: request.method,
        amount: request.amount.toJSON(),
      },
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null {
    return verifySharedSecretWebhook("sandbox-payout", rawBody, headers);
  }
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

/**
 * Indicative sandbox rates.
 *
 * These are NOT market rates and must never be presented as such — every
 * surface that shows a sandbox rate labels it. In production the FX provider
 * is swapped for a real rate feed; nothing else changes.
 */
const SANDBOX_BASE_RATES: Record<string, string> = {
  "EUR/ZAR": "19.85",
  "EUR/NGN": "1580.00",
  "EUR/GHS": "13.40",
  "EUR/KES": "139.50",
  "EUR/GBP": "0.8350",
  "EUR/USD": "1.0850",
  "GBP/ZAR": "23.77",
};

export class SandboxFxProvider implements FXProvider {
  readonly info: ProviderInfo = {
    key: "sandbox",
    displayName: "Sandbox FX rates (indicative, not market rates)",
    isLive: false,
    statusLabel: "Sandbox",
  };

  async getRate(baseCurrency: string, quoteCurrency: string): Promise<FxQuote> {
    const pair = `${baseCurrency}/${quoteCurrency}`;
    const base = SANDBOX_BASE_RATES[pair];
    if (!base) {
      throw new Error(
        `No sandbox rate for ${pair}. Add one, or configure a live FX provider.`,
      );
    }

    // A small deterministic intraday drift keeps quote expiry meaningful in a
    // demo without ever making the number look random.
    const minutesToday = Math.floor((Date.now() % 86_400_000) / 60_000);
    const drift = new RateDecimal(Math.sin(minutesToday / 120).toFixed(6)).times("0.0015");
    const marketRate = new RateDecimal(base)
      .times(new RateDecimal(1).plus(drift))
      .toDecimalPlaces(8);

    return {
      baseCurrency,
      quoteCurrency,
      marketRate,
      fetchedAt: new Date(),
      provider: "sandbox",
    };
  }
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export class SandboxKycProvider implements KYCProvider {
  readonly info = sandboxInfo("sandbox", "Sandbox identity verification");

  async startVerification(request: StartKycRequest): Promise<StartKycResult> {
    return {
      providerRef: sandboxRef("kyc"),
      status: "PENDING",
      verificationUrl: `${request.returnUrl}?sandbox=1`,
      raw: { sandbox: true, customerId: request.customerId, level: request.level ?? "standard" },
    };
  }

  async getStatus(providerRef: string) {
    return { status: "PENDING" as const, raw: { sandbox: true, providerRef } };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null {
    return verifySharedSecretWebhook("sandbox-kyc", rawBody, headers);
  }
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

/**
 * A deliberately tiny local watchlist so the review workflow can be exercised
 * end-to-end. It is a test fixture, not a sanctions list: real screening
 * requires a licensed data provider.
 */
const SANDBOX_WATCHLIST = ["test sanctioned person", "blocked payee", "denied party"];

export class SandboxScreeningProvider implements ScreeningProvider {
  readonly info = sandboxInfo("sandbox", "Sandbox screening (test fixture only)");

  async screen(request: ScreeningRequest): Promise<ScreeningResult> {
    const normalised = request.fullName.trim().toLowerCase();
    const match = SANDBOX_WATCHLIST.find((entry) => normalised.includes(entry));
    return {
      hit: Boolean(match),
      matches: match
        ? [{ listName: "SANDBOX_TEST_LIST", matchedName: match, score: 100 }]
        : [],
      provider: "sandbox",
      screenedAt: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Records the notification and logs it. Every notification is persisted to
 * `remit_notifications` by the caller either way, so swapping in a real email
 * provider changes only delivery, never the audit trail.
 */
export class SandboxNotificationProvider implements NotificationProvider {
  readonly info = sandboxInfo("sandbox", "Sandbox notifications (logged, not sent)");
  readonly supportedChannels: NotificationProvider["supportedChannels"] = ["EMAIL"];

  async send(request: SendNotificationRequest): Promise<SendNotificationResult> {
    if (process.env.NODE_ENV !== "test") {
      console.info(
        `[remit:notification:sandbox] ${request.channel} -> ${request.destination} :: ${request.template}`,
      );
    }
    return { providerRef: sandboxRef("ntf"), delivered: true };
  }
}

// ---------------------------------------------------------------------------
// Shared-secret webhook verification
// ---------------------------------------------------------------------------

/**
 * HMAC-SHA256 over the raw body, compared in constant time.
 *
 * When no secret is configured, verification fails closed. An unsigned webhook
 * is never processed — that is the whole point of the check.
 */
export function verifySharedSecretWebhook(
  provider: string,
  rawBody: string,
  headers: Record<string, string>,
): WebhookEnvelope | null {
  const secret = settings.webhooks.payoutSecret;
  if (!secret) return null;

  const signature = headers["x-remit-signature"] ?? headers["X-Remit-Signature"];
  if (!signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const computed = Buffer.from(expected, "utf8");
  if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
    return null;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }

  const externalId = typeof payload.id === "string" ? payload.id : null;
  const eventType = typeof payload.type === "string" ? payload.type : null;
  if (!externalId || !eventType) return null;

  return { provider, externalId, eventType, payload, signatureVerified: true };
}

export function signSharedSecretWebhook(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}
