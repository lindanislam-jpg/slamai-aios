import Stripe from "stripe";
import { Money } from "../../money/money";
import { settings } from "../../config/settings";
import {
  ProviderError,
  ProviderNotConfiguredError,
  type CreatePaymentRequest,
  type CreatePaymentResult,
  type PaymentProvider,
  type ProviderInfo,
  type WebhookEnvelope,
} from "../types";

/**
 * Stripe payment adapter — collects the customer's funds.
 *
 * IMPORTANT REGULATORY NOTE
 * Stripe collecting a card payment is not the same thing as being licensed to
 * transmit money internationally. This adapter covers the *pay-in* leg only.
 * The onward payout to the recipient must go through a licensed remittance /
 * payout partner behind `PayoutProvider`. Nothing in this codebase holds
 * customer funds.
 *
 * The adapter only activates when `STRIPE_SECRET_KEY` is present; otherwise the
 * registry falls back to the sandbox provider and the UI shows "Not yet
 * connected". Card details are never seen or stored by this application — the
 * client uses Stripe's hosted payment element and we only ever hold a token.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly info: ProviderInfo;
  readonly supportedMethods: PaymentProvider["supportedMethods"] = [
    "DEBIT_CARD",
    "CREDIT_CARD",
    "APPLE_PAY",
    "GOOGLE_PAY",
  ];

  private readonly client: Stripe;

  constructor(secretKey: string) {
    if (!secretKey) throw new ProviderNotConfiguredError("Payment", "stripe");
    this.client = new Stripe(secretKey);
    const isTestKey = secretKey.startsWith("sk_test_");
    this.info = {
      key: "stripe",
      displayName: "Stripe",
      isLive: !isTestKey,
      statusLabel: isTestKey ? "Sandbox (Stripe test mode)" : "Live",
    };
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: Number(request.amount.minor),
          currency: request.amount.currency.toLowerCase(),
          // Card details go straight from the browser to Stripe. This server
          // never touches a PAN.
          automatic_payment_methods: { enabled: true },
          description: `Transfer ${request.reference}`,
          metadata: {
            transferReference: request.reference,
            customerId: request.customer.id,
            ...request.metadata,
          },
          receipt_email: request.customer.email,
        },
        // Stripe-side idempotency: a retried request returns the original
        // intent instead of charging the customer twice.
        { idempotencyKey: request.idempotencyKey },
      );

      return {
        providerRef: intent.id,
        status: mapIntentStatus(intent.status),
        clientSecret: intent.client_secret ?? undefined,
        raw: { id: intent.id, status: intent.status, amount: intent.amount },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe payment failed";
      const retryable = error instanceof Stripe.errors.StripeConnectionError;
      throw new ProviderError(message, "stripe", retryable);
    }
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookEnvelope | null {
    const secret = settings.webhooks.stripeSecret;
    const signature = headers["stripe-signature"];
    if (!secret || !signature) return null;

    try {
      const event = this.client.webhooks.constructEvent(rawBody, signature, secret);
      return {
        provider: "stripe",
        externalId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        signatureVerified: true,
      };
    } catch {
      // A signature that does not verify is dropped, not processed.
      return null;
    }
  }

  /** Extract our transfer reference and the collection cost from an event. */
  static parsePaymentEvent(payload: Record<string, unknown>): {
    providerRef: string | null;
    transferReference: string | null;
    providerFee: Money | null;
  } {
    const event = payload as unknown as Stripe.Event;
    const object = event.data?.object as Stripe.PaymentIntent | undefined;
    if (!object) return { providerRef: null, transferReference: null, providerFee: null };
    return {
      providerRef: object.id ?? null,
      transferReference: (object.metadata?.transferReference as string) ?? null,
      providerFee: null,
    };
  }
}

function mapIntentStatus(status: Stripe.PaymentIntent.Status): CreatePaymentResult["status"] {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "processing":
      return "PENDING";
    case "canceled":
      return "FAILED";
    default:
      return "REQUIRES_ACTION";
  }
}
