import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  confirmVerificationCode,
  issueVerificationCode,
} from "@/remit/server/customer-service";
import type { RemitCustomer } from "@prisma/client";

/**
 * Email/phone verification against a real database.
 *
 * Covers two defects that made the deployed product unusable and leaked a
 * credential:
 *   1. The notification row was written straight to SENT without anyone ever
 *      handing it to a provider, so a configured email provider delivered
 *      nothing while the log claimed success.
 *   2. The plaintext code was persisted in the notification body, which undid
 *      the point of storing only its hash.
 */

const db = new PrismaClient();

async function makeCustomer(): Promise<RemitCustomer> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const email = `verify-${suffix}@example.test`;
  const user = await db.user.create({ data: { email, name: "Verify Tester" } });
  return db.remitCustomer.create({
    data: {
      userId: user.id,
      email,
      fullName: "Verify Tester",
      countryCode: "IE",
      status: "PENDING_VERIFICATION",
    },
  });
}

beforeEach(async () => {
  await db.remitNotification.deleteMany();
  await db.remitVerificationToken.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("issuing a verification code", () => {
  it("hands the code to the notification provider and records the real outcome", async () => {
    const customer = await makeCustomer();
    await issueVerificationCode(customer, "EMAIL");

    const notification = await db.remitNotification.findFirstOrThrow({
      where: { customerId: customer.id, template: "verification.code" },
    });

    // Previously this row said SENT with no send having happened.
    expect(notification.status).toBe("SENT");
    expect(notification.provider).toBe("sandbox");
    expect(notification.sentAt).not.toBeNull();
    expect(notification.destination).toBe(customer.email);
  });

  it("never persists the plaintext code, only its hash", async () => {
    const customer = await makeCustomer();
    const { devCode } = await issueVerificationCode(customer, "EMAIL");
    expect(devCode).toMatch(/^\d{6}$/);

    const notification = await db.remitNotification.findFirstOrThrow({
      where: { customerId: customer.id },
    });
    expect(notification.body).not.toContain(devCode!);
    expect(notification.body).toContain("••••••");

    const token = await db.remitVerificationToken.findFirstOrThrow({
      where: { customerId: customer.id },
    });
    expect(token.codeHash).not.toContain(devCode!);
    expect(token.codeHash).toHaveLength(64);
  });

  it("supersedes an outstanding code when a new one is requested", async () => {
    const customer = await makeCustomer();
    const first = await issueVerificationCode(customer, "EMAIL");
    const second = await issueVerificationCode(customer, "EMAIL");

    // The old code must stop working the moment a new one is issued.
    await expect(confirmVerificationCode(customer, "EMAIL", first.devCode!)).rejects.toThrow();
    const verified = await confirmVerificationCode(customer, "EMAIL", second.devCode!);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(verified.status).toBe("ACTIVE");
  });

  it("rejects a phone code when no number is on file", async () => {
    const customer = await makeCustomer();
    await expect(issueVerificationCode(customer, "PHONE")).rejects.toThrow(/phone number/);
  });
});

describe("confirming a verification code", () => {
  it("activates the account on the correct code", async () => {
    const customer = await makeCustomer();
    const { devCode } = await issueVerificationCode(customer, "EMAIL");

    const verified = await confirmVerificationCode(customer, "EMAIL", devCode!);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(verified.status).toBe("ACTIVE");

    const user = await db.user.findUniqueOrThrow({ where: { id: customer.userId } });
    expect(user.emailVerified).not.toBeNull();
  });

  it("counts a wrong attempt and refuses after too many", async () => {
    const customer = await makeCustomer();
    const { devCode } = await issueVerificationCode(customer, "EMAIL");
    const wrong = devCode === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i += 1) {
      await expect(confirmVerificationCode(customer, "EMAIL", wrong)).rejects.toThrow(
        /not correct/,
      );
    }

    // The correct code is refused too once the attempt budget is spent — a
    // brute-force run cannot simply keep going until it lands.
    await expect(confirmVerificationCode(customer, "EMAIL", devCode!)).rejects.toThrow(
      /Too many attempts/,
    );
  });

  it("refuses an expired code", async () => {
    const customer = await makeCustomer();
    const { devCode } = await issueVerificationCode(customer, "EMAIL");
    await db.remitVerificationToken.updateMany({
      where: { customerId: customer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(confirmVerificationCode(customer, "EMAIL", devCode!)).rejects.toThrow(/expired/);
  });

  it("cannot reuse a consumed code", async () => {
    const customer = await makeCustomer();
    const { devCode } = await issueVerificationCode(customer, "EMAIL");
    await confirmVerificationCode(customer, "EMAIL", devCode!);

    await expect(confirmVerificationCode(customer, "EMAIL", devCode!)).rejects.toThrow(
      /Request a new code/,
    );
  });
});
