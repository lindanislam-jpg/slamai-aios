import { db } from "@/lib/db";
import { clientIp, conflict, jsonOk, parseBody, route, userAgent } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { enforceRateLimit } from "@/remit/server/rate-limit";
import { serializeTransfer } from "@/remit/server/serialize";
import {
  ComplianceBlockedError,
  QuoteExpiredError,
  createTransfer,
} from "@/remit/server/transfer-service";
import { createTransferSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/remit/transfers — the signed-in customer's transfers. */
export const GET = route(async () => {
  const customer = await requireActiveCustomer();
  const transfers = await db.remitTransfer.findMany({
    where: { customerId: customer.id },
    include: { recipient: true, corridor: { select: { isLive: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jsonOk({ transfers: transfers.map((transfer) => serializeTransfer(transfer)) });
});

/**
 * POST /api/remit/transfers — confirm a quote into a real transfer.
 *
 * Requires an idempotency key. A repeated request with the same key returns the
 * original transfer with `deduplicated: true` rather than sending money twice.
 */
export const POST = route(async (request) => {
  const customer = await requireActiveCustomer();
  enforceRateLimit("transfer", customer.id);

  const input = await parseBody(request, createTransferSchema);

  try {
    const result = await createTransfer({
      customer,
      quoteId: input.quoteId,
      recipientId: input.recipientId,
      idempotencyKey: input.idempotencyKey,
      ip: clientIp(request),
      userAgent: userAgent(request),
    });

    const transfer = await db.remitTransfer.findUniqueOrThrow({
      where: { id: result.transfer.id },
      include: { recipient: true, corridor: { select: { isLive: true } }, events: true },
    });

    return jsonOk(
      {
        transfer: serializeTransfer(transfer, { includeTimeline: true }),
        deduplicated: result.deduplicated,
        payment: result.payment,
      },
      result.deduplicated ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof QuoteExpiredError) {
      throw conflict(error.message, { code: "QUOTE_EXPIRED" });
    }
    if (error instanceof ComplianceBlockedError) {
      // Deliberately vague to the customer: telling someone exactly which
      // control they tripped is how they learn to structure around it.
      throw conflict(error.message, { code: "COMPLIANCE_BLOCKED" });
    }
    throw error;
  }
});
