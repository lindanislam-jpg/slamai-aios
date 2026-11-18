import { NextResponse } from "next/server";
import { getPayoutProvider } from "@/remit/providers/registry";
import { markPayoutFailed, markPayoutPaid } from "@/remit/server/transfer-service";
import {
  findTransferByReference,
  headersToObject,
  processWebhook,
} from "@/remit/server/webhook-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/remit/webhooks/payout
 *
 * The payout partner confirms the recipient was paid, or that the payout
 * failed. Same rules as the payment webhook: verify the signature over the raw
 * body, then process exactly once.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const headers = headersToObject(request.headers);

  const provider = getPayoutProvider();
  const envelope = provider.verifyWebhook(rawBody, headers);
  if (!envelope) {
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } },
      { status: 400 },
    );
  }

  const outcome = await processWebhook(envelope, async (event) => {
    const data = (event.payload.data ?? event.payload) as Record<string, unknown>;
    const reference = typeof data.reference === "string" ? data.reference : null;
    if (!reference) throw new Error("Webhook did not carry a transfer reference");

    const transfer = await findTransferByReference(reference);
    if (!transfer) throw new Error(`Unknown transfer reference ${reference}`);

    const providerRef = typeof data.providerRef === "string" ? data.providerRef : undefined;

    if (event.eventType === "payout.paid") {
      await markPayoutPaid(transfer.id, { providerRef });
    } else if (event.eventType === "payout.failed" || event.eventType === "payout.returned") {
      await markPayoutFailed(
        transfer.id,
        typeof data.reason === "string" ? data.reason : "The payout could not be completed",
        providerRef,
      );
    }
  });

  if (outcome.error) return NextResponse.json({ received: true, retry: true }, { status: 500 });
  return NextResponse.json({ received: true, duplicate: outcome.duplicate });
}
