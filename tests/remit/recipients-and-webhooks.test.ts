import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getRecipientSchema,
  redactRecipientDetails,
  UnsupportedPayoutError,
  validateRecipientDetails,
} from "@/remit/corridors/recipient-schema";
import {
  signSharedSecretWebhook,
  verifySharedSecretWebhook,
} from "@/remit/providers/sandbox";
import { checkRateLimit, resetRateLimits } from "@/remit/server/rate-limit";

const VALID_ZA = {
  fullName: "Thandiwe Sample",
  bankCode: "CAPITEC",
  accountNumber: "1234567890",
  branchCode: "470010",
  accountType: "SAVINGS",
};

describe("recipient validation", () => {
  it("accepts a complete South African bank recipient", () => {
    const result = validateRecipientDetails("ZA", "BANK_DEPOSIT", VALID_ZA);
    expect(result.fullName).toBe("Thandiwe Sample");
    expect(result.details.branchCode).toBe("470010");
  });

  it("rejects a malformed account number", () => {
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, accountNumber: "12" }),
    ).toThrow();
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, accountNumber: "abcdefghij" }),
    ).toThrow();
  });

  it("rejects a branch code that is not six digits", () => {
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, branchCode: "4700" }),
    ).toThrow();
  });

  it("rejects a bank that is not on the supported list", () => {
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, bankCode: "NOT_A_BANK" }),
    ).toThrow();
  });

  it("requires every mandatory field", () => {
    const { branchCode, ...missing } = VALID_ZA;
    expect(branchCode).toBeDefined();
    expect(() => validateRecipientDetails("ZA", "BANK_DEPOSIT", missing)).toThrow();
  });

  it("strips nothing but refuses unexpected fields outright", () => {
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, nationalId: "9001015800085" }),
    ).toThrow();
  });

  it("treats an optional field as optional", () => {
    const withPhone = validateRecipientDetails("ZA", "BANK_DEPOSIT", {
      ...VALID_ZA,
      recipientPhone: "+27 82 000 0000",
    });
    expect(withPhone.details.recipientPhone).toBe("+27 82 000 0000");
    expect(() =>
      validateRecipientDetails("ZA", "BANK_DEPOSIT", { ...VALID_ZA, recipientPhone: "" }),
    ).not.toThrow();
  });

  it("has no schema for an unsupported corridor, and says so", () => {
    expect(getRecipientSchema("NG", "BANK_DEPOSIT")).toBeNull();
    expect(() => validateRecipientDetails("NG", "BANK_DEPOSIT", VALID_ZA)).toThrow(
      UnsupportedPayoutError,
    );
  });

  it("masks sensitive fields for logs and admin views", () => {
    const redacted = redactRecipientDetails("ZA", "BANK_DEPOSIT", VALID_ZA);
    expect(redacted.accountNumber).toBe("******7890");
    expect(redacted.branchCode).toBe("470010"); // not sensitive
  });
});

describe("webhook signature verification", () => {
  const SECRET = "test-webhook-secret";
  const body = JSON.stringify({ id: "evt_1", type: "payout.paid", data: { reference: "KS-A" } });

  beforeEach(() => {
    process.env.REMIT_PAYOUT_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.REMIT_PAYOUT_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed payload", async () => {
    const { settings } = await import("@/remit/config/settings");
    const signature = signSharedSecretWebhook(body, settings.webhooks.payoutSecret);
    const envelope = verifySharedSecretWebhook("sandbox-payout", body, {
      "x-remit-signature": signature,
    });
    expect(envelope).not.toBeNull();
    expect(envelope?.externalId).toBe("evt_1");
    expect(envelope?.signatureVerified).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const { settings } = await import("@/remit/config/settings");
    const signature = signSharedSecretWebhook(body, settings.webhooks.payoutSecret);
    const tampered = body.replace("KS-A", "KS-B");
    expect(
      verifySharedSecretWebhook("sandbox-payout", tampered, { "x-remit-signature": signature }),
    ).toBeNull();
  });

  it("rejects a payload with no signature at all", () => {
    expect(verifySharedSecretWebhook("sandbox-payout", body, {})).toBeNull();
  });

  it("rejects a signature signed with the wrong secret", () => {
    const signature = signSharedSecretWebhook(body, "not-the-secret");
    expect(
      verifySharedSecretWebhook("sandbox-payout", body, { "x-remit-signature": signature }),
    ).toBeNull();
  });

  it("rejects a body that is not valid JSON even when correctly signed", async () => {
    const { settings } = await import("@/remit/config/settings");
    const junk = "not json";
    const signature = signSharedSecretWebhook(junk, settings.webhooks.payoutSecret);
    expect(
      verifySharedSecretWebhook("sandbox-payout", junk, { "x-remit-signature": signature }),
    ).toBeNull();
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit and refuses the next one", () => {
    let last = { allowed: true, remaining: 0, resetAt: 0 };
    for (let i = 0; i < 10; i += 1) {
      last = checkRateLimit("transfer", "customer-1");
      expect(last.allowed).toBe(true);
    }
    expect(checkRateLimit("transfer", "customer-1").allowed).toBe(false);
  });

  it("keeps buckets separate per identity", () => {
    for (let i = 0; i < 11; i += 1) checkRateLimit("transfer", "customer-1");
    expect(checkRateLimit("transfer", "customer-2").allowed).toBe(true);
  });
});
