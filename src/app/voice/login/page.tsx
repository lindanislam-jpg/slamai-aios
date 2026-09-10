"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Phone } from "lucide-react";
import { Button, Field, Input, Loading } from "@/components/voice/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = params.get("next") ?? "/app";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      // Deliberately vague: naming which half was wrong helps an attacker
      // work out which email addresses have accounts.
      setError("That email and password don't match an account.");
      setSaving(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/voice" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Phone className="h-4.5 w-4.5 text-white" />
          </span>
          <span>
            <span className="block text-[16px] font-semibold leading-tight text-white">SlamAI</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-400">Voice</span>
          </span>
        </Link>

        <h1 className="text-center text-[24px] font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="mt-1.5 text-center text-[14px] text-slate-400">Sign in to your workspace.</p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <Field label="Email">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" error={error ?? undefined}>
            <Input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Sign in
          </Button>

          <div className="flex items-center justify-between text-[13px]">
            <Link href="/forgot-password" className="text-slate-500 hover:text-slate-300">Forgot password?</Link>
            <Link href="/voice/signup" className="text-indigo-400 hover:underline">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginForm />
    </Suspense>
  );
}
