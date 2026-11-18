"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, Button, Card, Field, inputClass } from "./ui";

/** Account creation. Password rules are enforced server-side too. */
export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrors({});

    const response = await fetch("/api/remit/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, countryCode: "IE" }),
    });
    const data = await response.json();

    if (!response.ok) {
      if (Array.isArray(data?.error?.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of data.error.details) fieldErrors[detail.field] = detail.message;
        setErrors(fieldErrors);
      }
      setError(data?.error?.message ?? "We could not create your account");
      setSubmitting(false);
      return;
    }

    // Sign the new customer straight in, then send them to verification.
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    const params = data.devCode ? `?code=${encodeURIComponent(data.devCode)}` : "";
    router.push(`/send/verify${params}`);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-[24px] font-bold tracking-tight text-send-ink">Create your account</h1>
      <p className="mt-1 text-[14px] text-send-body">
        Takes a minute. You will verify your email next.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Full legal name" htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            className={inputClass}
            placeholder="As it appears on your ID"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="phone"
          hint="Optional now. Needed before your first transfer."
          error={errors.phone}
        >
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={inputClass}
            placeholder="+353 87 000 0000"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint="At least 10 characters, with an upper-case letter and a number."
          error={errors.password}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            className={inputClass}
            placeholder="••••••••••"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-send-line p-3.5">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) => update("acceptedTerms", event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-send-primary"
          />
          <span className="text-[13px] leading-relaxed text-send-body">
            I accept the{" "}
            <Link href="/send/legal/terms" className="font-semibold text-send-primary underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/send/legal/privacy" className="font-semibold text-send-primary underline">
              Privacy Policy
            </Link>
            , and understand this is a sandbox environment that cannot move real money.
          </span>
        </label>
        {errors.acceptedTerms && (
          <p className="text-[12px] font-medium text-send-danger">{errors.acceptedTerms}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[14px] text-send-body">
        Already have an account?{" "}
        <Link href="/send/login" className="font-semibold text-send-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
