import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Money } from "@/remit/money/money";
import { createQuote } from "@/remit/server/quote-service";
import {
  ComplianceBlockedError,
  QuoteExpiredError,
  approveCompliance,
  cancelTransfer,
  createTransfer,
  rejectCompliance,
} from "@/remit/server/transfer-service";
import { advanceSandboxTransfer } from "@/remit/server/sandbox-simulator";
import { getKpis } from "@/remit/server/analytics-service";
import type { RemitCustomer } from "@prisma/client";

/**
 * End-to-end transfer flow against a real Postgres.
 *
 * This is where the guarantees that actually matter get proved: the unique
 * constraint that stops duplicate transfers, the transaction that consumes a
 * quote exactly once, and the state machine driving a transfer from PENDING to
 * COMPLETED through the same code paths a live provider would.
 */

const db = new PrismaClient();
let corridorId: string;

async function makeCustomer(overrides: Partial<RemitCustomer> = {}): Promise<RemitCustomer> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const email = `test-${suffix}@example.test`;
  const user = await db.user.create({ data: { email, name: "Test Sender" } });
  return db.remitCustomer.create({
    data: {
      userId: user.id,
      email,
      fullName: "Test Sender",
      countryCode: "IE",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      kycStatus: "APPROVED",
      kycApprovedAt: new Date(),
      isDemo: true,
      // Backdate the account so the "new account" risk signal does not fire.
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

async function makeRecipient(customerId: string, fullName = "Thandiwe Sample") {
  return db.remitRecipient.create({
    data: {
      customerId,
      fullName,
      destCountryCode: "ZA",
      destCurrency: "ZAR",
      payoutMethod: "BANK_DEPOSIT",
      details: {
        fullName,
        bankCode: "CAPITEC",
        accountNumber: "1234567890",
        branchCode: "470010",
        accountType: "SAVINGS",
      },
    },
  });
}

async function quoteFor(customerId: string, amount = "300") {
  const { quote } = await createQuote({
    customerId,
    sourceCountryCode: "IE",
    destCountryCode: "ZA",
    sourceAmount: amount,
    paymentMethod: "BANK_TRANSFER",
    payoutMethod: "BANK_DEPOSIT",
  });
  return quote;
}

/** Walk a sandbox transfer to completion the way the tracking screen does. */
async function runToCompletion(transferId: string): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const current = await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(current.status)) return current.status;
    // The simulator enforces a dwell time between steps; wind the clock back
    // rather than sleeping so the test stays fast and deterministic.
    await db.remitTransfer.update({
      where: { id: transferId },
      data: { updatedAt: new Date(Date.now() - 60_000) },
    });
    await advanceSandboxTransfer(transferId);
  }
  return (await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } })).status;
}

beforeAll(async () => {
  process.env.REMIT_DEMO_MODE = "true";
  const corridor = await db.remitCorridor.findUnique({
    where: { sourceCountryCode_destCountryCode: { sourceCountryCode: "IE", destCountryCode: "ZA" } },
  });
  if (!corridor) {
    throw new Error("Run `npm run db:seed:remit` before the integration tests");
  }
  corridorId = corridor.id;
});

beforeEach(async () => {
  // Start each test from a clean ledger so analytics assertions are exact.
  await db.remitTransferEvent.deleteMany();
  await db.remitPayment.deleteMany();
  await db.remitPayout.deleteMany();
  await db.remitRiskReview.deleteMany();
  await db.remitNotification.deleteMany();
  await db.remitTransfer.deleteMany();
  await db.remitQuote.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("quote creation", () => {
  it("prices €300 IE→ZA with a €5 fee and a €305 total", async () => {
    const customer = await makeCustomer();
    const quote = await quoteFor(customer.id);

    expect(quote.sourceAmountMinor).toBe(30_000n);
    expect(quote.feeMinor).toBe(500n);
    expect(quote.totalPayableMinor).toBe(30_500n);
    expect(quote.destCurrency).toBe("ZAR");
    expect(quote.destAmountMinor).toBeGreaterThan(0n);
    expect(quote.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("derives the recipient amount from the rate it stored", async () => {
    const customer = await makeCustomer();
    const quote = await quoteFor(customer.id);
    const expected = Money.fromMinor(quote.sourceAmountMinor, "EUR").convert(
      quote.customerRate.toString(),
      "ZAR",
    );
    expect(quote.destAmountMinor).toBe(expected.minor);
  });

  it("records the market rate it was given", async () => {
    const customer = await makeCustomer();
    const quote = await quoteFor(customer.id);
    // Zero margin on this corridor: the customer gets the market rate.
    expect(quote.fxMarginBps).toBe(0);
    expect(quote.customerRate.toString()).toBe(quote.marketRate.toString());
    const logged = await db.remitExchangeRate.findFirst({ orderBy: { fetchedAt: "desc" } });
    expect(logged?.baseCurrency).toBe("EUR");
  });

  it("refuses an amount outside the corridor's limits", async () => {
    const customer = await makeCustomer();
    await expect(quoteFor(customer.id, "5")).rejects.toThrow();
    await expect(quoteFor(customer.id, "9999")).rejects.toThrow();
  });

  it("refuses a corridor we do not support", async () => {
    const customer = await makeCustomer();
    await expect(
      createQuote({
        customerId: customer.id,
        sourceCountryCode: "IE",
        destCountryCode: "NG",
        sourceAmount: "300",
        paymentMethod: "BANK_TRANSFER",
        payoutMethod: "BANK_DEPOSIT",
      }),
    ).rejects.toThrow();
  });

  it("refuses a payment method that is not enabled on the corridor", async () => {
    const customer = await makeCustomer();
    await expect(
      createQuote({
        customerId: customer.id,
        sourceCountryCode: "IE",
        destCountryCode: "ZA",
        sourceAmount: "300",
        // Card is configured but disabled until a real acquirer is connected.
        paymentMethod: "DEBIT_CARD",
        payoutMethod: "BANK_DEPOSIT",
      }),
    ).rejects.toThrow();
  });
});

describe("transfer creation", () => {
  it("creates a transfer, snapshots the quote and initiates payment", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    const result = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-create-1",
    });

    expect(result.deduplicated).toBe(false);
    expect(result.transfer.status).toBe("PROCESSING");
    expect(result.transfer.reference).toMatch(/^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // The pricing is frozen onto the transfer, not re-read from the quote.
    expect(result.transfer.feeMinor).toBe(500n);
    expect(result.transfer.totalPayableMinor).toBe(30_500n);
    expect(result.transfer.customerRate.toString()).toBe(quote.customerRate.toString());

    const consumed = await db.remitQuote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(consumed.status).toBe("CONSUMED");

    const payment = await db.remitPayment.findFirst({ where: { transferId: result.transfer.id } });
    expect(payment?.amountMinor).toBe(30_500n);
  });

  it("returns the original transfer when the same idempotency key is reused", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    const first = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-dedupe",
    });
    const second = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-dedupe",
    });

    expect(second.deduplicated).toBe(true);
    expect(second.transfer.id).toBe(first.transfer.id);
    expect(await db.remitTransfer.count({ where: { customerId: customer.id } })).toBe(1);
  });

  it("survives two concurrent submissions of the same transfer", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    const results = await Promise.allSettled([
      createTransfer({
        customer,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-race",
      }),
      createTransfer({
        customer,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-race",
      }),
    ]);

    const succeeded = results.filter((result) => result.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    // Whatever the interleaving, exactly one transfer exists.
    expect(await db.remitTransfer.count({ where: { customerId: customer.id } })).toBe(1);
  });

  it("cannot use the same quote twice, even with a different idempotency key", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-a",
    });
    await expect(
      createTransfer({
        customer,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-b",
      }),
    ).rejects.toThrow(/already been used/);
  });

  it("refuses an expired quote and does not create a transfer", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);
    await db.remitQuote.update({
      where: { id: quote.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      createTransfer({
        customer,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-expired",
      }),
    ).rejects.toThrow(QuoteExpiredError);
    expect(await db.remitTransfer.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it("refuses another customer's quote", async () => {
    const owner = await makeCustomer();
    const attacker = await makeCustomer();
    const recipient = await makeRecipient(attacker.id);
    const quote = await quoteFor(owner.id);

    await expect(
      createTransfer({
        customer: attacker,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-steal",
      }),
    ).rejects.toThrow(/another account/);
  });

  it("refuses another customer's recipient", async () => {
    const owner = await makeCustomer();
    const attacker = await makeCustomer();
    const recipient = await makeRecipient(owner.id);
    const quote = await quoteFor(attacker.id);

    await expect(
      createTransfer({
        customer: attacker,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-steal-recipient",
      }),
    ).rejects.toThrow(/another account/);
  });
});

describe("the full journey", () => {
  it("runs €300 IE→ZA from creation to COMPLETED", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-journey",
    });

    const finalStatus = await runToCompletion(transfer.id);
    expect(finalStatus).toBe("COMPLETED");

    const completed = await db.remitTransfer.findUniqueOrThrow({
      where: { id: transfer.id },
      include: { events: { orderBy: { createdAt: "asc" } }, payouts: true, payments: true },
    });

    expect(completed.completedAt).not.toBeNull();
    expect(completed.events.map((event) => event.toStatus)).toEqual([
      "PENDING",
      "PROCESSING",
      "PAYMENT_RECEIVED",
      "CONVERTING",
      "SENT",
      "COMPLETED",
    ]);
    expect(completed.payments[0].status).toBe("SUCCEEDED");
    expect(completed.payouts[0].status).toBe("PAID");
    expect(completed.payouts[0].amountMinor).toBe(quote.destAmountMinor);
    // Every sandbox transfer is flagged so it can never be read as real money.
    expect(completed.isDemo).toBe(true);
  });

  it("emails the customer at each meaningful step", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-notify",
    });
    await runToCompletion(transfer.id);

    const templates = (
      await db.remitNotification.findMany({ where: { transferId: transfer.id } })
    ).map((notification) => notification.template);

    expect(templates).toContain("transfer.created");
    expect(templates).toContain("transfer.payment_received");
    expect(templates).toContain("transfer.sent");
    expect(templates).toContain("transfer.completed");
  });

  it("writes an audit entry for every step", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-audit",
    });
    await runToCompletion(transfer.id);

    const actions = (
      await db.remitAuditLog.findMany({ where: { entityId: transfer.id } })
    ).map((log) => log.action);

    expect(actions).toContain("transfer.created");
    expect(actions).toContain("transfer.status.completed");
  });

  it("lets a customer cancel before the money is collected, and not after", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-cancel",
    });

    const cancelled = await cancelTransfer(transfer.id, customer);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(cancelTransfer(transfer.id, customer)).rejects.toThrow();
  });
});

describe("compliance workflow", () => {
  it("pauses a high-value transfer and resumes it on approval", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    // €1,000+ is at the manual review threshold.
    const quote = await quoteFor(customer.id, "1500");

    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-review",
    });

    expect(transfer.status).toBe("COMPLIANCE_REVIEW");
    expect(transfer.complianceStatus).toBe("REVIEW_REQUIRED");
    // No money is requested while a transfer is paused for review.
    expect(await db.remitPayment.count({ where: { transferId: transfer.id } })).toBe(0);

    const review = await db.remitRiskReview.findFirstOrThrow({ where: { transferId: transfer.id } });
    expect(review.status).toBe("OPEN");

    const admin = await db.user.create({
      data: { email: `admin-${Date.now()}@example.test`, name: "Reviewer" },
    });
    await approveCompliance(transfer.id, admin.id, "Documents checked");

    const resumed = await db.remitTransfer.findUniqueOrThrow({ where: { id: transfer.id } });
    expect(resumed.complianceStatus).toBe("APPROVED");
    expect(resumed.status).toBe("PROCESSING");
    expect(await runToCompletion(transfer.id)).toBe("COMPLETED");
  });

  it("fails a transfer that compliance rejects", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id, "1500");
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-reject",
    });

    const admin = await db.user.create({
      data: { email: `admin-${Date.now()}-2@example.test`, name: "Reviewer" },
    });
    const rejected = await rejectCompliance(transfer.id, admin.id, "Could not verify source of funds");

    expect(rejected.status).toBe("FAILED");
    expect(rejected.complianceStatus).toBe("REJECTED");
    expect(rejected.failureReason).toBeTruthy();
  });

  it("blocks a transfer to a screened name outright", async () => {
    const customer = await makeCustomer();
    // Matches the sandbox screening fixture.
    const recipient = await makeRecipient(customer.id, "Test Sanctioned Person");
    const quote = await quoteFor(customer.id);

    await expect(
      createTransfer({
        customer,
        quoteId: quote.id,
        recipientId: recipient.id,
        idempotencyKey: "key-screened",
      }),
    ).rejects.toThrow(ComplianceBlockedError);
    expect(await db.remitTransfer.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it("reviews a transfer from a customer who has not completed verification", async () => {
    const customer = await makeCustomer({ kycStatus: "NOT_STARTED", kycApprovedAt: null });
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);

    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-nokyc",
    });
    expect(transfer.status).toBe("COMPLIANCE_REVIEW");
  });

  it("cannot be advanced past review by the sandbox simulator", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id, "1500");
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-review-stuck",
    });

    expect(await runToCompletion(transfer.id)).toBe("COMPLIANCE_REVIEW");
  });
});

describe("business analytics", () => {
  it("reports fee revenue net of provider costs, not as pure profit", async () => {
    const customer = await makeCustomer();
    const recipient = await makeRecipient(customer.id);
    const quote = await quoteFor(customer.id);
    const { transfer } = await createTransfer({
      customer,
      quoteId: quote.id,
      recipientId: recipient.id,
      idempotencyKey: "key-analytics",
    });
    await runToCompletion(transfer.id);

    const kpis = await getKpis();
    expect(kpis.completedTransfers).toBe(1);
    expect(kpis.totalVolume.amount).toBe("300.00");
    expect(kpis.feeRevenue.amount).toBe("5.00");
    // The sandbox payment provider charges us to collect the funds, so gross
    // margin must be strictly less than the €5 fee.
    expect(Number(kpis.providerCosts.amount)).toBeGreaterThan(0);
    expect(Number(kpis.grossMargin.amount)).toBeLessThan(5);
    expect(kpis.successRate).toBe(1);
  });
});

describe("corridor configuration", () => {
  it("keeps the corridor data-driven rather than hardcoded", async () => {
    const corridor = await db.remitCorridor.findUniqueOrThrow({ where: { id: corridorId } });
    expect(corridor.sourceCurrency).toBe("EUR");
    expect(corridor.destCurrency).toBe("ZAR");
    // Not connected to a regulated provider yet — the UI must say so.
    expect(corridor.isLive).toBe(false);
  });
});
