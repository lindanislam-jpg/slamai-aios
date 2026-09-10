import { z } from "zod";

/**
 * Request schemas. Every API route parses its body through one of these — a
 * route never reads a raw field off `request.json()`.
 *
 * Note what is absent: no route accepts a fee, an exchange rate, a recipient
 * amount, a total or a transfer status from the client. Those are computed
 * server-side, always.
 */

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a 2-letter country code");

const paymentMethod = z.enum([
  "BANK_TRANSFER",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "APPLE_PAY",
  "GOOGLE_PAY",
]);

const payoutMethod = z.enum(["BANK_DEPOSIT", "MOBILE_WALLET", "CASH_PICKUP"]);

/** Amounts arrive as decimal strings so they never pass through a float. */
const amountString = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .regex(/[a-z]/, "Include a lower-case letter")
    .regex(/[A-Z]/, "Include an upper-case letter")
    .regex(/\d/, "Include a number"),
  countryCode: countryCode.default("IE"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,16}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You need to accept the terms to continue" }),
  }),
});

export const verifyCodeSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE"]),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resendCodeSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE"]),
});

export const quoteSchema = z.object({
  sourceCountryCode: countryCode,
  destCountryCode: countryCode,
  sourceAmount: amountString,
  paymentMethod: paymentMethod.default("BANK_TRANSFER"),
  payoutMethod: payoutMethod.default("BANK_DEPOSIT"),
  promoCode: z.string().trim().max(32).optional(),
});

export const createRecipientSchema = z.object({
  nickname: z.string().trim().max(60).optional(),
  destCountryCode: countryCode,
  payoutMethod,
  /** Shape validated against the corridor's field schema, server-side. */
  details: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const createTransferSchema = z.object({
  quoteId: z.string().trim().min(1),
  recipientId: z.string().trim().min(1),
  /**
   * Required. Without one we cannot distinguish a retry from a second
   * transfer, and a duplicate transfer is real money lost.
   */
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,16}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().trim().max(120).optional(),
  addressLine2: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
});

// --- Admin -----------------------------------------------------------------

export const complianceDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().trim().max(1000).optional(),
});

export const suspendCustomerSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const feeRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  corridorId: z.string().trim().min(1).nullable().optional(),
  segment: z.string().trim().max(40).nullable().optional(),
  promoCode: z.string().trim().max(32).nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3),
  /** Decimal string, e.g. "5.00". Converted to minor units server-side. */
  fixedFee: amountString,
  percentageBps: z.number().int().min(0).max(10_000).default(0),
  minAmount: amountString.nullable().optional(),
  maxAmount: amountString.nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const corridorUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  fxMarginBps: z.number().int().min(0).max(1000).optional(),
  minAmount: amountString.optional(),
  maxAmount: amountString.optional(),
  dailyLimit: amountString.optional(),
  monthlyLimit: amountString.optional(),
});

export const transferSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.string().trim().max(30).optional(),
  compliance: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
