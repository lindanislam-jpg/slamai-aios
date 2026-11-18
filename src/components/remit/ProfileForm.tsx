"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Alert, Button, Card, Field, SandboxBadge, inputClass } from "./ui";

interface Profile {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  dateOfBirth: string;
  countryCode: string;
  status: string;
  kycStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isDemo: boolean;
}

const KYC_COPY: Record<string, { tone: "success" | "warning" | "danger"; label: string }> = {
  APPROVED: { tone: "success", label: "Verified" },
  PENDING: { tone: "warning", label: "In progress" },
  IN_REVIEW: { tone: "warning", label: "Being reviewed" },
  NOT_STARTED: { tone: "warning", label: "Not started" },
  REJECTED: { tone: "danger", label: "Not successful" },
  EXPIRED: { tone: "warning", label: "Expired" },
};

/** Profile details and account status. Email is not editable here on purpose. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const kyc = KYC_COPY[form.kycStatus] ?? KYC_COPY.NOT_STARTED;

  function update(field: keyof Profile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    const response = await fetch("/api/remit/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        phone: form.phone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        postalCode: form.postalCode,
        dateOfBirth: form.dateOfBirth || undefined,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      if (Array.isArray(data?.error?.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of data.error.details) fieldErrors[detail.field] = detail.message;
        setErrors(fieldErrors);
      }
      setError(data?.error?.message ?? "We could not save your details");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-send-ink">Account status</h2>
            <p className="mt-0.5 text-[13px] text-send-body">{form.email}</p>
          </div>
          {form.isDemo && <SandboxBadge />}
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Account", form.status.replace(/_/g, " ").toLowerCase()],
            ["Email", form.emailVerified ? "Verified" : "Not verified"],
            ["Identity", kyc.label],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-send-line px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                {label}
              </dt>
              <dd className="mt-0.5 text-[14px] font-bold capitalize text-send-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {form.kycStatus !== "APPROVED" && (
          <Link
            href="/send/verify-identity"
            className="mt-4 inline-flex min-h-[46px] items-center rounded-xl bg-send-primary px-5 text-[15px] font-bold text-white hover:bg-send-primary-strong"
          >
            Verify your identity
          </Link>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Your details</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-send-muted">
          These must match your identity documents. Contact support to change your email address.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Your details are saved.</Alert>}

          <Field label="Full legal name" htmlFor="fullName" error={errors.fullName}>
            <input
              id="fullName"
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Mobile number"
            htmlFor="phone"
            hint={form.phoneVerified ? "Verified" : "Changing this will require re-verification."}
            error={errors.phone}
          >
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={inputClass}
              placeholder="+353 87 000 0000"
            />
          </Field>

          <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth}>
            <input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1}>
            <input
              id="addressLine1"
              value={form.addressLine1}
              onChange={(event) => update("addressLine1", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Address line 2 (optional)" htmlFor="addressLine2">
            <input
              id="addressLine2"
              value={form.addressLine2}
              onChange={(event) => update("addressLine2", event.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="city" error={errors.city}>
              <input
                id="city"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Postal code" htmlFor="postalCode" error={errors.postalCode}>
              <input
                id="postalCode"
                value={form.postalCode}
                onChange={(event) => update("postalCode", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Session</h2>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => signOut({ callbackUrl: "/send" })}
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
}
