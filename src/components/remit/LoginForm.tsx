"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, Button, Card, Field, inputClass } from "./ui";

/**
 * Sign in.
 *
 * The failure message is deliberately identical for a wrong password and an
 * unknown email — telling an attacker which addresses have accounts is an
 * account-enumeration gift.
 */
export function LoginForm({ demoMode, demoEmail }: { demoMode: boolean; demoEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("That email and password do not match an account.");
      setSubmitting(false);
      return;
    }

    router.push("/send/home");
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-[24px] font-bold tracking-tight text-send-ink">Welcome back</h1>
      <p className="mt-1 text-[14px] text-send-body">Sign in to send money or track a transfer.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            placeholder="••••••••••"
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[14px] text-send-body">
        New here?{" "}
        <Link href="/send/register" className="font-semibold text-send-primary hover:underline">
          Create an account
        </Link>
      </p>

      {demoMode && (
        <div className="mt-6 rounded-xl border border-send-accent/40 bg-send-accent-soft p-4">
          <div className="text-[12px] font-black uppercase tracking-wide text-send-warning">
            Demo account
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-send-warning">
            Sign in as <strong>{demoEmail}</strong> with the demo password from your seed output to
            walk the full journey. Every transfer it creates is a sandbox transfer — no money moves.
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail(demoEmail);
              setPassword("DemoSend123!");
            }}
            className="mt-3 text-[13px] font-bold text-send-warning underline"
          >
            Fill the demo credentials
          </button>
        </div>
      )}
    </Card>
  );
}
