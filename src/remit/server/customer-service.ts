import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getKycProvider, getNotificationProvider } from "../providers/registry";
import { settings } from "../config/settings";
import { wordmark } from "../config/brand";
import { recordAudit } from "./audit";
import { badRequest, conflict, notFound } from "./api";
import type { RemitCustomer } from "@prisma/client";

/**
 * Customer onboarding: account creation, email/phone verification and starting
 * KYC with the verification provider.
 */

const BCRYPT_ROUNDS = 12;
const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  countryCode: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
}

export async function registerCustomer(input: RegisterInput): Promise<RemitCustomer> {
  const email = input.email.toLowerCase();

  const existingCustomer = await db.remitCustomer.findUnique({ where: { email } });
  if (existingCustomer) {
    throw conflict("An account with that email already exists. Sign in instead.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const customer = await db.$transaction(async (tx) => {
    // The platform user may already exist (this module shares the platform's
    // authentication). We never overwrite an existing password.
    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      user = await tx.user.create({
        data: { email, name: input.fullName, password: passwordHash },
      });
    } else if (!user.password) {
      user = await tx.user.update({ where: { id: user.id }, data: { password: passwordHash } });
    } else {
      throw conflict("An account with that email already exists. Sign in instead.");
    }

    return tx.remitCustomer.create({
      data: {
        userId: user.id,
        fullName: input.fullName,
        email,
        phone: input.phone || null,
        countryCode: input.countryCode,
        status: "PENDING_VERIFICATION",
      },
    });
  });

  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: "customer.registered",
    entityType: "RemitCustomer",
    entityId: customer.id,
    metadata: { countryCode: input.countryCode },
    ipAddress: input.ip,
    userAgent: input.userAgent,
  });

  return customer;
}

// ---------------------------------------------------------------------------
// Verification codes
// ---------------------------------------------------------------------------

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Issue a 6-digit code. Only the hash is stored, so a database leak cannot be
 * replayed to verify somebody else's account.
 */
export async function issueVerificationCode(
  customer: RemitCustomer,
  channel: "EMAIL" | "PHONE",
): Promise<{ destination: string; devCode?: string }> {
  const destination = channel === "EMAIL" ? customer.email : customer.phone;
  if (!destination) throw badRequest("Add a phone number to your profile first");

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  // Supersede any outstanding code for this channel.
  await db.remitVerificationToken.updateMany({
    where: { customerId: customer.id, channel, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await db.remitVerificationToken.create({
    data: {
      customerId: customer.id,
      channel,
      codeHash: hashCode(code),
      destination,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  const subject = "Your verification code";
  const body =
    `Your verification code is ${code}.\n\n` +
    `It expires in ${CODE_TTL_MINUTES} minutes. If you did not ask for this, ignore this email.\n\n` +
    `— ${wordmark()}`;

  // The notification row deliberately stores a REDACTED body. Only the SHA-256
  // hash of the code is persisted (above); writing the plaintext code into the
  // notification log would undo that hashing entirely and leave a replayable
  // credential sitting in the database.
  const notification = await db.remitNotification.create({
    data: {
      customerId: customer.id,
      channel: channel === "EMAIL" ? "EMAIL" : "SMS",
      template: "verification.code",
      destination,
      subject,
      body: body.replace(code, "••••••"),
      status: "QUEUED",
    },
  });

  // Actually hand it to the provider. Previously this row was written straight
  // to SENT without anyone sending anything, so a configured email provider
  // still delivered nothing and the log claimed otherwise.
  let delivered = false;
  try {
    const provider = getNotificationProvider();
    const result = await provider.send({
      channel: channel === "EMAIL" ? "EMAIL" : "SMS",
      destination,
      subject,
      body,
      template: "verification.code",
    });
    delivered = result.delivered;
    await db.remitNotification.update({
      where: { id: notification.id },
      data: {
        status: result.delivered ? "SENT" : "FAILED",
        provider: provider.info.key,
        error: result.error ?? null,
        sentAt: result.delivered ? new Date() : null,
      },
    });
  } catch (error) {
    await db.remitNotification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Send failed" },
    });
  }

  // The code is handed back only when it could not have reached the customer
  // any other way: outside production, or when no real email provider is
  // connected. Both conditions are server-side environment facts, so no request
  // can turn this on. With a live provider in production it is never returned.
  const noRealProvider = settings.providers.notification === "sandbox";
  const exposeCode = process.env.NODE_ENV !== "production" || (!delivered && noRealProvider);

  return { destination, devCode: exposeCode ? code : undefined };
}

export async function confirmVerificationCode(
  customer: RemitCustomer,
  channel: "EMAIL" | "PHONE",
  code: string,
): Promise<RemitCustomer> {
  const token = await db.remitVerificationToken.findFirst({
    where: { customerId: customer.id, channel, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!token) throw badRequest("Request a new code");
  if (token.expiresAt <= new Date()) throw badRequest("That code has expired. Request a new one.");
  if (token.attempts >= MAX_CODE_ATTEMPTS) {
    throw badRequest("Too many attempts. Request a new code.");
  }

  const provided = Buffer.from(hashCode(code), "utf8");
  const expected = Buffer.from(token.codeHash, "utf8");
  const matches =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!matches) {
    await db.remitVerificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    throw badRequest("That code is not correct");
  }

  await db.remitVerificationToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });

  const updated = await db.remitCustomer.update({
    where: { id: customer.id },
    data:
      channel === "EMAIL"
        ? { emailVerifiedAt: new Date(), status: "ACTIVE" }
        : { phoneVerifiedAt: new Date() },
  });

  if (channel === "EMAIL") {
    await db.user.update({
      where: { id: customer.userId },
      data: { emailVerified: new Date() },
    });
  }

  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: `customer.verified.${channel.toLowerCase()}`,
    entityType: "RemitCustomer",
    entityId: customer.id,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export async function startKyc(
  customer: RemitCustomer,
  returnUrl: string,
): Promise<{ verificationUrl?: string; status: string; isSandbox: boolean }> {
  if (customer.kycStatus === "APPROVED") {
    return { status: "APPROVED", isSandbox: false };
  }

  const provider = getKycProvider();
  const result = await provider.startVerification({
    customerId: customer.id,
    email: customer.email,
    fullName: customer.fullName,
    countryCode: customer.countryCode,
    returnUrl,
  });

  await db.remitKycCheck.create({
    data: {
      customerId: customer.id,
      provider: provider.info.key,
      providerRef: result.providerRef,
      status: result.status,
      payload: result.raw as object,
    },
  });

  await db.remitCustomer.update({
    where: { id: customer.id },
    data: { kycStatus: result.status },
  });

  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: "kyc.started",
    entityType: "RemitCustomer",
    entityId: customer.id,
    metadata: { provider: provider.info.key },
  });

  return {
    verificationUrl: result.verificationUrl,
    status: result.status,
    isSandbox: !provider.info.isLive,
  };
}

/**
 * Record a KYC decision. Called by the provider's webhook in production, and by
 * the sandbox flow in demo mode.
 */
export async function applyKycDecision(
  customerId: string,
  status: "APPROVED" | "REJECTED" | "IN_REVIEW",
  reason?: string,
): Promise<RemitCustomer> {
  const customer = await db.remitCustomer.findUnique({ where: { id: customerId } });
  if (!customer) throw notFound("Customer not found");

  await db.remitKycCheck.updateMany({
    where: { customerId, status: { in: ["PENDING", "IN_REVIEW"] } },
    data: { status, reason },
  });

  const updated = await db.remitCustomer.update({
    where: { id: customerId },
    data: {
      kycStatus: status,
      kycApprovedAt: status === "APPROVED" ? new Date() : null,
      status: status === "APPROVED" && customer.emailVerifiedAt ? "ACTIVE" : customer.status,
    },
  });

  await recordAudit({
    actorType: "PROVIDER",
    action: `kyc.${status.toLowerCase()}`,
    entityType: "RemitCustomer",
    entityId: customerId,
    metadata: { reason: reason ?? null },
  });

  return updated;
}
