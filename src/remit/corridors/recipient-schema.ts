import { z } from "zod";

/**
 * Recipient field schemas, keyed by destination country + payout method.
 *
 * Payout networks want different things in different countries, and we collect
 * nothing beyond what the network actually needs — a South African bank deposit
 * needs a branch code, an IBAN country does not, and neither needs a date of
 * birth. Adding a country means adding an entry here, not editing forms.
 */

export type FieldType = "text" | "select" | "number";

export interface RecipientField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  maxLength?: number;
  /** Regex the value must match, as a string so it can travel to the client. */
  pattern?: string;
  patternMessage?: string;
  options?: { value: string; label: string }[];
  /** Marks a field as personal data that must never appear in logs. */
  sensitive?: boolean;
}

export interface RecipientSchema {
  countryCode: string;
  payoutMethod: string;
  /** Shown above the form to explain why each field is needed. */
  note?: string;
  fields: RecipientField[];
}

const ZA_BANKS = [
  { value: "ABSA", label: "Absa Bank" },
  { value: "CAPITEC", label: "Capitec Bank" },
  { value: "FNB", label: "First National Bank" },
  { value: "NEDBANK", label: "Nedbank" },
  { value: "STANDARD_BANK", label: "Standard Bank" },
  { value: "TYME", label: "TymeBank" },
  { value: "AFRICAN_BANK", label: "African Bank" },
  { value: "DISCOVERY", label: "Discovery Bank" },
  { value: "INVESTEC", label: "Investec" },
];

const SCHEMAS: RecipientSchema[] = [
  {
    countryCode: "ZA",
    payoutMethod: "BANK_DEPOSIT",
    note: "South African banks match payments on the account holder's name exactly as it appears on the account.",
    fields: [
      {
        name: "fullName",
        label: "Recipient's full legal name",
        type: "text",
        placeholder: "As it appears on their bank account",
        required: true,
        maxLength: 120,
        pattern: "^[\\p{L}\\p{M}'\\-. ]{2,120}$",
        patternMessage: "Use letters, spaces, apostrophes and hyphens only",
        sensitive: true,
      },
      {
        name: "bankCode",
        label: "Bank",
        type: "select",
        required: true,
        options: ZA_BANKS,
      },
      {
        name: "accountNumber",
        label: "Account number",
        type: "text",
        placeholder: "7-11 digits",
        required: true,
        pattern: "^\\d{7,11}$",
        patternMessage: "South African account numbers are 7-11 digits",
        sensitive: true,
      },
      {
        name: "branchCode",
        label: "Branch code",
        type: "text",
        placeholder: "6 digits",
        helpText: "Most banks use a single universal branch code.",
        required: true,
        pattern: "^\\d{6}$",
        patternMessage: "Branch codes are 6 digits",
      },
      {
        name: "accountType",
        label: "Account type",
        type: "select",
        required: true,
        options: [
          { value: "CURRENT", label: "Current / Cheque" },
          { value: "SAVINGS", label: "Savings" },
          { value: "TRANSMISSION", label: "Transmission" },
        ],
      },
      {
        name: "recipientPhone",
        label: "Recipient's mobile number",
        type: "text",
        placeholder: "+27 82 000 0000",
        helpText: "Used only so the payout partner can contact them if the deposit fails.",
        required: false,
        pattern: "^\\+?[0-9 ]{9,16}$",
        patternMessage: "Enter a valid mobile number",
        sensitive: true,
      },
    ],
  },
];

export function getRecipientSchema(
  countryCode: string,
  payoutMethod: string,
): RecipientSchema | null {
  return (
    SCHEMAS.find(
      (schema) => schema.countryCode === countryCode && schema.payoutMethod === payoutMethod,
    ) ?? null
  );
}

export class UnsupportedPayoutError extends Error {
  constructor(countryCode: string, payoutMethod: string) {
    super(`No recipient schema for ${payoutMethod} in ${countryCode}`);
    this.name = "UnsupportedPayoutError";
  }
}

/**
 * Build a zod validator for a payout schema. Validation always runs
 * server-side; the client form uses the same field definitions so the two can
 * never drift apart.
 */
export function buildRecipientValidator(schema: RecipientSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of schema.fields) {
    let validator: z.ZodTypeAny;

    if (field.type === "select") {
      const values = (field.options ?? []).map((option) => option.value);
      validator = z.string().refine((value) => values.includes(value), {
        message: `Choose one of: ${values.join(", ")}`,
      });
    } else {
      let stringValidator = z.string().trim();
      if (field.maxLength) stringValidator = stringValidator.max(field.maxLength);
      if (field.pattern) {
        stringValidator = stringValidator.regex(
          new RegExp(field.pattern, "u"),
          field.patternMessage ?? `${field.label} is not in the expected format`,
        );
      }
      validator = stringValidator;
    }

    if (field.required) {
      shape[field.name] =
        field.type === "select" ? validator : (validator as z.ZodString).min(1, `${field.label} is required`);
    } else {
      shape[field.name] = z.preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        validator.optional(),
      );
    }
  }

  // `.strict()` rejects unexpected keys outright: it stops a client stuffing
  // extra personal data into the details blob.
  return z.object(shape).strict();
}

export interface ValidatedRecipientDetails {
  details: Record<string, string>;
  fullName: string;
}

export function validateRecipientDetails(
  countryCode: string,
  payoutMethod: string,
  input: unknown,
): ValidatedRecipientDetails {
  const schema = getRecipientSchema(countryCode, payoutMethod);
  if (!schema) throw new UnsupportedPayoutError(countryCode, payoutMethod);

  const parsed = buildRecipientValidator(schema).parse(input) as Record<string, string>;
  const fullName = parsed.fullName;
  if (!fullName) {
    throw new Error("Recipient schema must include a fullName field");
  }
  return { details: parsed, fullName };
}

/** Field names safe to include in logs and admin exports. */
export function redactRecipientDetails(
  countryCode: string,
  payoutMethod: string,
  details: Record<string, unknown>,
): Record<string, unknown> {
  const schema = getRecipientSchema(countryCode, payoutMethod);
  if (!schema) return {};
  const redacted: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const value = details[field.name];
    if (value === undefined) continue;
    redacted[field.name] = field.sensitive ? maskValue(String(value)) : value;
  }
  return redacted;
}

export function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
