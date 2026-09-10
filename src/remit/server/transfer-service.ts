import "server-only";
import { db } from "@/lib/db";
import { Decimal, Money } from "../money/money";
import { isQuoteExpired } from "../quotes/quote-calculator";
import { assertTransition, isCancellable, type TransferStatus } from "../transfers/status";
import { getPaymentProvider, getPayoutProvider } from "../providers/registry";
import { assessTransfer } from "./compliance-service";
import { generateTransferReference } from "./reference";
import { recordAudit, recordAuditTx } from "./audit";
import { notifyTransfer, STATUS_NOTIFICATIONS } from "./notifications";
import { badRequest, conflict, forbidden, notFound } from "./api";
import type { Prisma, RemitActorType, RemitCustomer, RemitTransfer } from "@prisma/client";

/**
 * The transfer engine.
 *
 * Every status change in the system goes through `transition`, which:
 *   - validates the move against the state machine
 *   - writes an append-only event row inside the same transaction
 *   - writes the audit log inside the same transaction
 *
 * No route, admin action or webhook writes `status` directly.
 */

export interface Actor {
  type: RemitActorType;
  id?: string | null;
}

const SYSTEM: Actor = { type: "SYSTEM" };

export interface TransitionOptions {
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  /** Extra columns to write atomically with the status change. */
  data?: Prisma.RemitTransferUpdateInput;
  notify?: boolean;
}

export async function transition(
  transferId: string,
  to: TransferStatus,
  actor: Actor = SYSTEM,
  options: TransitionOptions = {},
): Promise<RemitTransfer> {
  const updated = await db.$transaction(async (tx) => {
    const current = await tx.remitTransfer.findUnique({ where: { id: transferId } });
    if (!current) throw notFound("Transfer not found");

    // No-op transitions are silently accepted so a provider retrying a webhook
    // does not produce a duplicate event or an error.
    if (current.status === to) return current;

    assertTransition(current.status as TransferStatus, to);

    const transfer = await tx.remitTransfer.update({
      where: { id: transferId },
      data: {
        ...options.data,
        status: to,
        completedAt: to === "COMPLETED" ? new Date() : (options.data?.completedAt ?? undefined),
      },
    });

    await tx.remitTransferEvent.create({
      data: {
        transferId,
        fromStatus: current.status,
        toStatus: to,
        actorType: actor.type,
        actorId: actor.id ?? null,
        reason: options.reason,
        metadata: options.metadata,
      },
    });

    await recordAuditTx(tx, {
      actorType: actor.type,
      actorId: actor.id,
      action: `transfer.status.${to.toLowerCase()}`,
      entityType: "RemitTransfer",
      entityId: transferId,
      metadata: { from: current.status, to, reason: options.reason ?? null },
    });

    return transfer;
  });

  if (options.notify !== false) {
    const template = STATUS_NOTIFICATIONS[to];
    if (template) {
      const recipient = await db.remitRecipient.findUnique({
        where: { id: updated.recipientId },
        select: { fullName: true },
      });
      await notifyTransfer(template, {
        customerId: updated.customerId,
        transfer: updated,
        recipientName: recipient?.fullName ?? "your recipient",
      });
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Creating a transfer
// ---------------------------------------------------------------------------

export interface CreateTransferInput {
  customer: RemitCustomer;
  quoteId: string;
  recipientId: string;
  /** Client-supplied. Same key + same customer = same transfer, never a second one. */
  idempotencyKey: string;
  ip?: string;
  userAgent?: string;
}

export interface CreateTransferResult {
  transfer: RemitTransfer;
  /** True when an existing transfer was returned rather than a new one created. */
  deduplicated: boolean;
  payment: { clientSecret?: string; redirectUrl?: string; providerRef: string } | null;
}

export async function createTransfer(input: CreateTransferInput): Promise<CreateTransferResult> {
  const { customer, quoteId, recipientId, idempotencyKey } = input;

  // 1. Idempotency — the double-tap guard. Checked before anything else so a
  //    retried request can never produce a second transfer.
  const existing = await db.remitTransfer.findUnique({
    where: { customerId_idempotencyKey: { customerId: customer.id, idempotencyKey } },
  });
  if (existing) {
    return { transfer: existing, deduplicated: true, payment: null };
  }

  // 2. Quote — must belong to this customer, be unused, and still be valid.
  const quote = await db.remitQuote.findUnique({
    where: { id: quoteId },
    include: {
      corridor: { include: { destCountry: true, sourceCountry: true } },
    },
  });
  if (!quote) throw notFound("Quote not found");
  if (quote.customerId !== customer.id) throw forbidden("That quote belongs to another account");
  if (quote.status === "CONSUMED") throw conflict("That quote has already been used");
  if (quote.status === "EXPIRED" || isQuoteExpired(quote)) {
    await db.remitQuote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
    throw new QuoteExpiredError();
  }

  // 3. Recipient — must belong to this customer and match the quote's corridor.
  const recipient = await db.remitRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.isArchived) throw notFound("Recipient not found");
  if (recipient.customerId !== customer.id) {
    throw forbidden("That recipient belongs to another account");
  }
  if (recipient.destCountryCode !== quote.corridor.destCountryCode) {
    throw badRequest("That recipient is in a different country from your quote");
  }
  if (recipient.payoutMethod !== quote.payoutMethod) {
    throw badRequest("That recipient uses a different payout method from your quote");
  }

  const sourceAmount = Money.fromMinor(quote.sourceAmountMinor, quote.sourceCurrency);

  // 4. Compliance. Runs before any money is requested from the customer.
  const assessment = await assessTransfer({
    customer,
    corridor: quote.corridor,
    recipient,
    sourceAmount,
  });

  if (assessment.hardStop) {
    await recordAudit({
      actorType: "SYSTEM",
      actorId: null,
      action: "transfer.blocked",
      entityType: "RemitCustomer",
      entityId: customer.id,
      metadata: { code: assessment.hardStop.code, quoteId },
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });
    throw new ComplianceBlockedError(assessment.hardStop.reason);
  }

  const needsReview = assessment.decision === "REVIEW_REQUIRED";

  // 5. Create the transfer, consume the quote and open a review — atomically.
  //    The unique (customerId, idempotencyKey) index is the real guarantee
  //    here: two concurrent requests cannot both insert.
  let transfer: RemitTransfer;
  try {
    transfer = await db.$transaction(async (tx) => {
      const consumed = await tx.remitQuote.updateMany({
        where: { id: quote.id, status: "ACTIVE" },
        data: { status: "CONSUMED" },
      });
      if (consumed.count === 0) {
        throw conflict("That quote has already been used");
      }

      const created = await tx.remitTransfer.create({
        data: {
          reference: generateTransferReference(),
          customerId: customer.id,
          corridorId: quote.corridorId,
          quoteId: quote.id,
          recipientId: recipient.id,
          sourceCurrency: quote.sourceCurrency,
          destCurrency: quote.destCurrency,
          sourceAmountMinor: quote.sourceAmountMinor,
          feeMinor: quote.feeMinor,
          marketRate: quote.marketRate,
          customerRate: quote.customerRate,
          fxMarginBps: quote.fxMarginBps,
          destAmountMinor: quote.destAmountMinor,
          totalPayableMinor: quote.totalPayableMinor,
          paymentMethod: quote.paymentMethod,
          payoutMethod: quote.payoutMethod,
          status: "PENDING",
          complianceStatus: needsReview ? "REVIEW_REQUIRED" : "NORMAL",
          riskScore: assessment.score,
          riskReasons: assessment.signals.map((signal) => signal.code),
          isDemo: customer.isDemo || !quote.corridor.isLive,
          idempotencyKey,
        },
      });

      await tx.remitTransferEvent.create({
        data: {
          transferId: created.id,
          fromStatus: null,
          toStatus: "PENDING",
          actorType: "CUSTOMER",
          actorId: customer.id,
          reason: "Transfer created from quote",
          metadata: {
            quoteId: quote.id,
            riskScore: assessment.score,
            signals: assessment.signals.map((signal) => signal.code),
          },
        },
      });

      if (needsReview) {
        await tx.remitRiskReview.create({
          data: {
            transferId: created.id,
            reasons: assessment.signals.map((signal) => signal.description),
            riskScore: assessment.score,
            status: "OPEN",
          },
        });
      }

      await recordAuditTx(tx, {
        actorType: "CUSTOMER",
        actorId: customer.id,
        action: "transfer.created",
        entityType: "RemitTransfer",
        entityId: created.id,
        metadata: {
          reference: created.reference,
          amount: sourceAmount.toDecimalString(),
          currency: created.sourceCurrency,
          riskScore: assessment.score,
        },
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });

      return created;
    });
  } catch (error) {
    // Losing the race on the unique index means the other request won; return
    // its transfer rather than an error.
    if (isUniqueViolation(error, "idempotencyKey")) {
      const winner = await db.remitTransfer.findUnique({
        where: { customerId_idempotencyKey: { customerId: customer.id, idempotencyKey } },
      });
      if (winner) return { transfer: winner, deduplicated: true, payment: null };
    }
    throw error;
  }

  await notifyTransfer("transfer.created", {
    customerId: customer.id,
    transfer,
    recipientName: recipient.fullName,
  });

  // 6. A transfer flagged for review pauses here — no payment is taken until a
  //    human clears it.
  if (needsReview) {
    const paused = await transition(transfer.id, "COMPLIANCE_REVIEW", SYSTEM, {
      reason: "Flagged for compliance review",
      metadata: { signals: assessment.signals.map((signal) => signal.code) },
    });
    return { transfer: paused, deduplicated: false, payment: null };
  }

  const payment = await initiatePayment(transfer.id);
  const refreshed = await db.remitTransfer.findUniqueOrThrow({ where: { id: transfer.id } });
  return { transfer: refreshed, deduplicated: false, payment };
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/**
 * Ask the payment provider to collect the customer's funds and move the
 * transfer to PROCESSING.
 */
export async function initiatePayment(
  transferId: string,
): Promise<CreateTransferResult["payment"]> {
  const transfer = await db.remitTransfer.findUniqueOrThrow({
    where: { id: transferId },
    include: { customer: true, corridor: { include: { paymentOptions: true } } },
  });

  const existingPayment = await db.remitPayment.findFirst({
    where: { transferId, status: { in: ["PENDING", "REQUIRES_ACTION", "SUCCEEDED"] } },
  });
  if (existingPayment) {
    return {
      providerRef: existingPayment.providerRef ?? "",
      clientSecret: undefined,
      redirectUrl: undefined,
    };
  }

  const option = transfer.corridor.paymentOptions.find(
    (candidate) => candidate.method === transfer.paymentMethod,
  );
  const provider = getPaymentProvider(option?.providerKey);
  const total = Money.fromMinor(transfer.totalPayableMinor, transfer.sourceCurrency);

  const result = await provider.createPayment({
    reference: transfer.reference,
    amount: total,
    method: transfer.paymentMethod,
    // The transfer reference is stable and unique, so a retry of this call
    // reaches the provider's own idempotency layer too.
    idempotencyKey: `pay_${transfer.reference}`,
    customer: {
      id: transfer.customerId,
      email: transfer.customer.email,
      name: transfer.customer.fullName,
    },
    metadata: { transferId: transfer.id },
  });

  await db.remitPayment.create({
    data: {
      transferId: transfer.id,
      provider: provider.info.key,
      providerRef: result.providerRef,
      method: transfer.paymentMethod,
      amountMinor: total.minor,
      currency: total.currency,
      status: result.status,
      providerFeeMinor: result.providerFee?.minor ?? 0n,
      rawResponse: result.raw as Prisma.InputJsonValue,
    },
  });

  // The collection cost is recorded on the payment row now, but only added to
  // the transfer's cost total when the provider confirms the outcome — see
  // `markPaymentReceived`. Counting it here as well would double it.
  await transition(transfer.id, "PROCESSING", SYSTEM, {
    reason: `Payment initiated with ${provider.info.displayName}`,
    metadata: { providerRef: result.providerRef, sandbox: !provider.info.isLive },
  });

  return {
    providerRef: result.providerRef,
    clientSecret: result.clientSecret,
    redirectUrl: result.redirectUrl,
  };
}

/** Funds confirmed by the payment provider. Advances the transfer. */
export async function markPaymentReceived(
  transferId: string,
  details: { providerRef?: string; providerFeeMinor?: bigint } = {},
): Promise<RemitTransfer> {
  if (details.providerRef) {
    await db.remitPayment.updateMany({
      where: { transferId, providerRef: details.providerRef },
      data: {
        status: "SUCCEEDED",
        providerFeeMinor: details.providerFeeMinor ?? undefined,
      },
    });
  }

  const transfer = await transition(transferId, "PAYMENT_RECEIVED", { type: "PROVIDER" }, {
    reason: "Funds confirmed by the payment provider",
    data: details.providerFeeMinor
      ? { providerCostMinor: { increment: details.providerFeeMinor } }
      : undefined,
  });

  // A transfer flagged at creation waits here for a human decision.
  if (transfer.complianceStatus === "REVIEW_REQUIRED") {
    return transition(transferId, "COMPLIANCE_REVIEW", SYSTEM, {
      reason: "Held for compliance review before conversion",
    });
  }

  return convertAndSend(transferId);
}

export async function markPaymentFailed(
  transferId: string,
  reason: string,
  providerRef?: string,
): Promise<RemitTransfer> {
  if (providerRef) {
    await db.remitPayment.updateMany({
      where: { transferId, providerRef },
      data: { status: "FAILED", failureReason: reason },
    });
  }
  return transition(transferId, "FAILED", { type: "PROVIDER" }, {
    reason,
    data: { failureReason: reason },
  });
}

// ---------------------------------------------------------------------------
// Conversion and payout
// ---------------------------------------------------------------------------

/**
 * Convert at the rate locked in the quote and instruct the payout partner.
 *
 * The rate is never re-fetched: the customer agreed to a number and that number
 * is what settles, whatever the market has done since.
 */
export async function convertAndSend(transferId: string): Promise<RemitTransfer> {
  await transition(transferId, "CONVERTING", SYSTEM, {
    reason: "Converting at the rate locked in the quote",
    notify: false,
  });

  const transfer = await db.remitTransfer.findUniqueOrThrow({
    where: { id: transferId },
    include: { recipient: true, corridor: { include: { payoutOptions: true } } },
  });

  const option = transfer.corridor.payoutOptions.find(
    (candidate) => candidate.method === transfer.payoutMethod,
  );
  const provider = getPayoutProvider(option?.providerKey);
  const destAmount = Money.fromMinor(transfer.destAmountMinor, transfer.destCurrency);

  try {
    const result = await provider.createPayout({
      reference: transfer.reference,
      amount: destAmount,
      method: transfer.payoutMethod,
      idempotencyKey: `out_${transfer.reference}`,
      destCountryCode: transfer.corridor.destCountryCode,
      recipient: {
        fullName: transfer.recipient.fullName,
        details: transfer.recipient.details as Record<string, unknown>,
      },
      metadata: { transferId: transfer.id },
    });

    await db.remitPayout.create({
      data: {
        transferId: transfer.id,
        provider: provider.info.key,
        providerRef: result.providerRef,
        method: transfer.payoutMethod,
        amountMinor: destAmount.minor,
        currency: destAmount.currency,
        status: result.status,
        providerCostMinor: result.providerCost?.minor ?? 0n,
        rawResponse: result.raw as Prisma.InputJsonValue,
      },
    });

    // The payout partner charges us in the destination currency. Reporting is
    // in the source currency, so convert at this transfer's own rate — leaving
    // it out would quietly overstate the margin on every transfer.
    const payoutCost = result.providerCost
      ? toSourceCurrency(result.providerCost, transfer.customerRate.toString(), transfer.sourceCurrency)
      : null;

    return transition(transfer.id, "SENT", SYSTEM, {
      reason: `Sent to ${provider.info.displayName}`,
      metadata: { providerRef: result.providerRef, sandbox: !provider.info.isLive },
      data: payoutCost ? { providerCostMinor: { increment: payoutCost.minor } } : undefined,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Payout could not be created";
    return transition(transfer.id, "FAILED", SYSTEM, {
      reason,
      data: { failureReason: "We could not send this transfer to the payout partner" },
    });
  }
}

/** The payout partner confirms the recipient has been paid. */
export async function markPayoutPaid(
  transferId: string,
  details: { providerRef?: string; providerCostMinor?: bigint } = {},
): Promise<RemitTransfer> {
  if (details.providerRef) {
    await db.remitPayout.updateMany({
      where: { transferId, providerRef: details.providerRef },
      data: { status: "PAID", providerCostMinor: details.providerCostMinor ?? undefined },
    });
  }
  return transition(transferId, "COMPLETED", { type: "PROVIDER" }, {
    reason: "Recipient paid",
  });
}

export async function markPayoutFailed(
  transferId: string,
  reason: string,
  providerRef?: string,
): Promise<RemitTransfer> {
  if (providerRef) {
    await db.remitPayout.updateMany({
      where: { transferId, providerRef },
      data: { status: "FAILED", failureReason: reason },
    });
  }
  return transition(transferId, "FAILED", { type: "PROVIDER" }, {
    reason,
    data: { failureReason: "The payout could not be completed. Your money will be returned." },
  });
}

// ---------------------------------------------------------------------------
// Compliance decisions
// ---------------------------------------------------------------------------

export async function approveCompliance(
  transferId: string,
  adminUserId: string,
  notes?: string,
): Promise<RemitTransfer> {
  const transfer = await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });
  if (transfer.status !== "COMPLIANCE_REVIEW") {
    throw conflict("That transfer is not awaiting a compliance decision");
  }

  await db.remitRiskReview.updateMany({
    where: { transferId, status: "OPEN" },
    data: { status: "APPROVED", decidedById: adminUserId, decidedAt: new Date(), notes },
  });

  await db.remitTransfer.update({
    where: { id: transferId },
    data: { complianceStatus: "APPROVED" },
  });

  await recordAudit({
    actorType: "ADMIN",
    actorId: adminUserId,
    action: "compliance.approved",
    entityType: "RemitTransfer",
    entityId: transferId,
    metadata: { notes: notes ?? null },
  });

  // Where the transfer resumes depends on whether we already hold the funds.
  const payment = await db.remitPayment.findFirst({
    where: { transferId, status: "SUCCEEDED" },
  });

  if (payment) return convertAndSend(transferId);

  await transition(transferId, "PROCESSING", { type: "ADMIN", id: adminUserId }, {
    reason: "Compliance approved — collecting payment",
    notify: false,
  });
  await initiatePayment(transferId);
  return db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });
}

export async function rejectCompliance(
  transferId: string,
  adminUserId: string,
  notes: string,
): Promise<RemitTransfer> {
  const transfer = await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });
  if (transfer.status !== "COMPLIANCE_REVIEW") {
    throw conflict("That transfer is not awaiting a compliance decision");
  }

  await db.remitRiskReview.updateMany({
    where: { transferId, status: "OPEN" },
    data: { status: "REJECTED", decidedById: adminUserId, decidedAt: new Date(), notes },
  });

  await db.remitTransfer.update({
    where: { id: transferId },
    data: { complianceStatus: "REJECTED" },
  });

  await recordAudit({
    actorType: "ADMIN",
    actorId: adminUserId,
    action: "compliance.rejected",
    entityType: "RemitTransfer",
    entityId: transferId,
    metadata: { notes },
  });

  return transition(transferId, "FAILED", { type: "ADMIN", id: adminUserId }, {
    reason: "Rejected at compliance review",
    data: {
      failureReason:
        "We were not able to complete this transfer. Any funds collected will be returned.",
    },
  });
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export async function cancelTransfer(
  transferId: string,
  customer: RemitCustomer,
): Promise<RemitTransfer> {
  const transfer = await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });
  if (transfer.customerId !== customer.id) throw forbidden("That transfer is not yours");
  if (!isCancellable(transfer.status as TransferStatus)) {
    throw conflict("This transfer can no longer be cancelled");
  }
  return transition(transferId, "CANCELLED", { type: "CUSTOMER", id: customer.id }, {
    reason: "Cancelled by the customer",
  });
}

// ---------------------------------------------------------------------------

/**
 * Convert a destination-currency amount back to the source currency at the
 * transfer's own rate. Used for cost reporting only — never for anything the
 * customer is shown or charged.
 */
function toSourceCurrency(amount: Money, customerRate: string, sourceCurrency: string): Money {
  const inverse = new Decimal(1).dividedBy(new Decimal(customerRate));
  return amount.convert(inverse, sourceCurrency);
}

export class QuoteExpiredError extends Error {
  constructor() {
    super("Your quote has expired. Get a new one to see the current rate.");
    this.name = "QuoteExpiredError";
  }
}

export class ComplianceBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ComplianceBlockedError";
  }
}

function isUniqueViolation(error: unknown, field: string): boolean {
  const candidate = error as { code?: string; meta?: { target?: string[] | string } };
  if (candidate?.code !== "P2002") return false;
  const target = candidate.meta?.target;
  const targets = Array.isArray(target) ? target : [target ?? ""];
  return targets.some((entry) => String(entry).includes(field));
}
