import { describe, expect, it } from "vitest";
import { blockingProblems, checkEnvironment, summarise } from "@/remit/config/preflight";
import { buildResendPayload } from "@/remit/providers/resend/notification";
import type { SendNotificationRequest } from "@/remit/providers/types";

const COMPLETE = {
  NEXTAUTH_SECRET: "a-secret",
  DATABASE_URL: "postgresql://localhost:5432/db",
  REMIT_NOTIFICATION_PROVIDER: "resend",
  RESEND_API_KEY: "re_test",
};

describe("deployment preflight", () => {
  it("flags a missing auth secret, which is what breaks sign-in before any password is checked", () => {
    const checks = checkEnvironment({ ...COMPLETE, NEXTAUTH_SECRET: undefined });
    const secret = checks.find((check) => check.name === "NEXTAUTH_SECRET");
    expect(secret?.status).toBe("missing");
    expect(blockingProblems(checks)).toHaveLength(1);
    expect(summarise(checks).ok).toBe(false);
  });

  it("flags a missing database url", () => {
    const checks = checkEnvironment({ ...COMPLETE, DATABASE_URL: undefined });
    expect(checks.find((check) => check.name === "DATABASE_URL")?.status).toBe("missing");
    expect(summarise(checks).ok).toBe(false);
  });

  it("reports both when both are missing", () => {
    const checks = checkEnvironment({});
    expect(blockingProblems(checks).map((check) => check.name)).toEqual([
      "NEXTAUTH_SECRET",
      "DATABASE_URL",
    ]);
  });

  it("passes a fully configured environment", () => {
    const report = summarise(checkEnvironment(COMPLETE));
    expect(report.ok).toBe(true);
    expect(blockingProblems(report.checks)).toHaveLength(0);
  });

  it("warns, but does not block, when only the sandbox email provider is configured", () => {
    const checks = checkEnvironment({ ...COMPLETE, REMIT_NOTIFICATION_PROVIDER: "sandbox" });
    const email = checks.find((check) => check.name === "Email delivery");
    expect(email?.status).toBe("warning");
    // A demo deployment with no email provider is degraded, not broken.
    expect(summarise(checks).ok).toBe(true);
    expect(blockingProblems(checks)).toHaveLength(0);
  });

  it("errors when a real email provider is selected without its key", () => {
    const checks = checkEnvironment({ ...COMPLETE, RESEND_API_KEY: undefined });
    expect(checks.find((check) => check.name === "Email delivery")?.status).toBe("error");
  });

  it("never reports the value of anything", () => {
    const secretValue = "super-secret-value";
    const checks = checkEnvironment({ ...COMPLETE, NEXTAUTH_SECRET: secretValue });
    const serialised = JSON.stringify(checks);
    expect(serialised).not.toContain(secretValue);
    expect(serialised).not.toContain("re_test");
    expect(serialised).not.toContain("postgresql://");
  });
});

describe("Resend payload", () => {
  const request: SendNotificationRequest = {
    channel: "EMAIL",
    destination: "customer@example.com",
    subject: "Your verification code",
    body: "Your verification code is 123456.",
    template: "verification.code",
  };

  it("builds the documented Resend shape", () => {
    const payload = buildResendPayload(request, "Kora Send <no-reply@example.com>");
    expect(payload).toEqual({
      from: "Kora Send <no-reply@example.com>",
      to: ["customer@example.com"],
      subject: "Your verification code",
      text: "Your verification code is 123456.",
    });
  });

  it("includes a reply-to only when one is configured", () => {
    expect(buildResendPayload(request, "a@b.com").reply_to).toBeUndefined();
    expect(buildResendPayload(request, "a@b.com", "support@example.com").reply_to).toBe(
      "support@example.com",
    );
  });

  it("refuses a channel it cannot deliver rather than silently dropping it", () => {
    expect(() =>
      buildResendPayload({ ...request, channel: "SMS" }, "a@b.com"),
    ).toThrow(/only sends email/);
  });
});
