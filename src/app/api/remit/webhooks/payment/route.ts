import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/remit/providers/registry";
import { markPaymentFailed, markPaymentReceived } from "@/remit/server/transfer-service";
import {
  findTransferByReference,
  headersToObject,
  processWebhook,
} from "@/remit/server/webhook-service";
import { StripePaymentProvider } from "@/remit/providers/stripe/payment";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/webhooks/payment
 *
 * The payment provider tells us the customer's funds cleared (or did not).
 * The raw body is read as text because the signature is computed over the exact
 * bytes — parsing first and re-serialising would break verification.
 *
 * An unsigned or badly-signed request gets a 400 and is never processed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const headers = headersToObject(request.headers);

  const provider = getPaymentProvider();
  const envelope = provider.verifyWebhook(rawBody, headers);
  if (!envelope) {
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } },
      { status: 400 },
    );
  }

  const outcome = await processWebhook(envelope, async (event) => {
    const { reference, providerRef, failureReason } = extractPaymentEvent(event.payload, event.eventType);
    if (!reference) throw new Error("Webhook did not carry a transfer reference");

    const transfer = await findTransferByReference(reference);
    if (!transfer) throw new Error(`Unknown transfer reference ${reference}`);

    if (isSuccess(event.eventType)) {
      await markPaymentReceived(transfer.id, { providerRef });
    } else if (isFailure(event.eventType)) {
      await markPaymentFailed(
        transfer.id,
        failureReason ?? "The payment did not go through",
        providerRef,
      );
    }
    // Any other event type is recorded but takes no action.
  });

  // Always 200 on a duplicate so the provider stops retrying; 500 on a genuine
  // handler failure so it retries and we do not silently drop a payment.
  if (outcome.error) return NextResponse.json({ received: true, retry: true }, { status: 500 });
  return NextResponse.json({ received: true, duplicate: outcome.duplicate });
}

function isSuccess(eventType: string): boolean {
  return ["payment_intent.succeeded", "payment.succeeded", "payment.completed"].includes(eventType);
}

function isFailure(eventType: string): boolean {
  return [
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "payment.failed",
  ].includes(eventType);
}

function extractPaymentEvent(
  payload: Record<string, unknown>,
  eventType: string,
): { reference: string | null; providerRef?: string; failureReason?: string } {
  if (eventType.startsWith("payment_intent.")) {
    const parsed = StripePaymentProvider.parsePaymentEvent(payload);
    return {
      reference: parsed.transferReference,
      providerRef: parsed.providerRef ?? undefined,
    };
  }
  const data = (payload.data ?? payload) as Record<string, unknown>;
  return {
    reference: typeof data.reference === "string" ? data.reference : null,
    providerRef: typeof data.providerRef === "string" ? data.providerRef : undefined,
    failureReason: typeof data.reason === "string" ? data.reason : undefined,
  };
}
