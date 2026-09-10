"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Field, inputClass } from "./ui";

/**
 * Email verification.
 *
 * Outside production the code is handed back by the register endpoint and
 * pre-filled here, so the journey is completable without a live email provider.
 * In production `devCode` is never returned and this field starts empty.
 */
export function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/remit/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "EMAIL", code }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "That code did not work");
      setSubmitting(false);
      return;
    }

    router.push("/send/verify-identity");
    router.refresh();
  }

  async function resend() {
    setError(null);
    const response = await fetch("/api/remit/auth/verify/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "EMAIL" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error?.message ?? "Could not send a new code");
      return;
    }
    if (data.devCode) setCode(data.devCode);
    setNotice(`A new code is on its way to ${data.destination}.`);
  }

  return (
    <Card>
      <h1 className="text-[24px] font-bold tracking-tight text-send-ink">Verify your email</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-send-body">
        We sent a 6-digit code to <strong className="text-send-ink">{email}</strong>.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <Field label="Verification code" htmlFor="code">
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            className={`${inputClass} tnum text-center text-[28px] font-bold tracking-[0.4em]`}
            placeholder="000000"
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={submitting || code.length !== 6}>
          {submitting ? "Checking…" : "Verify email"}
        </Button>
      </form>

      <button
        type="button"
        onClick={resend}
        className="mt-4 w-full text-center text-[13px] font-semibold text-send-primary hover:underline"
      >
        Send me a new code
      </button>
    </Card>
  );
}
