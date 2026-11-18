"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, inputClass } from "./ui";
import type { Recipient } from "./SendMoneyFlow";

/**
 * Recipient form, built from the payout schema the server returns for the
 * destination country.
 *
 * The fields are not hardcoded here: adding a country adds an entry to
 * src/remit/corridors/recipient-schema.ts and this form follows. The same
 * definitions validate the submission server-side, so a client that skips a
 * check gains nothing.
 */

interface RecipientField {
  name: string;
  label: string;
  type: "text" | "select" | "number";
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

interface Schema {
  note?: string;
  fields: RecipientField[];
}

export function RecipientForm({
  countryCode,
  payoutMethod,
  onCreated,
  onCancel,
}: {
  countryCode: string;
  payoutMethod: string;
  onCreated: (recipient: Recipient) => void;
  onCancel?: () => void;
}) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [nickname, setNickname] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(
        `/api/remit/recipients/fields?country=${countryCode}&method=${payoutMethod}`,
      );
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(data?.error?.message ?? "We could not load the recipient form");
        return;
      }
      setSchema(data.schema);
      setValues(
        Object.fromEntries(
          data.schema.fields.map((field: RecipientField) => [
            field.name,
            field.type === "select" ? (field.options?.[0]?.value ?? "") : "",
          ]),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [countryCode, payoutMethod]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    const response = await fetch("/api/remit/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: nickname || undefined,
        destCountryCode: countryCode,
        payoutMethod,
        // Empty optional fields are dropped rather than sent as "".
        details: Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== ""),
        ),
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      if (Array.isArray(data?.error?.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of data.error.details) {
          fieldErrors[detail.field.replace(/^details\./, "")] = detail.message;
        }
        setErrors(fieldErrors);
      }
      setError(data?.error?.message ?? "We could not save that recipient");
      return;
    }

    onCreated(data.recipient);
  }

  if (error && !schema) return <Alert tone="danger">{error}</Alert>;
  if (!schema) return <p className="text-[14px] text-send-muted">Loading recipient details…</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {schema.note && <Alert tone="info">{schema.note}</Alert>}

      <Field
        label="Nickname"
        htmlFor="nickname"
        hint="Just for you — how this recipient appears in your list."
      >
        <input
          id="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          className={inputClass}
          placeholder="Mum"
        />
      </Field>

      {schema.fields.map((field) => (
        <Field
          key={field.name}
          label={field.required ? field.label : `${field.label} (optional)`}
          htmlFor={field.name}
          hint={field.helpText}
          error={errors[field.name]}
        >
          {field.type === "select" ? (
            <select
              id={field.name}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
              className={inputClass}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.name}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
              className={inputClass}
              placeholder={field.placeholder}
            />
          )}
        </Field>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save recipient"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-send-muted">
        We only ask for what the payout network in this country needs to deposit the money. Account
        details are stored for future transfers and masked everywhere they are displayed.
      </p>
    </form>
  );
}
