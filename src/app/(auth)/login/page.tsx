"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Phone } from "lucide-react";
import { Button, Field, Input, Loading } from "@/components/voice/ui";

/**
 * The one sign-in page for the platform.
 *
 * Both products share an account, so after signing in this decides where the
 * person actually belongs: a SlamAI Voice workspace sends them to /app,
 * anything else to the wider AIOS dashboard. A customer never has to know
 * which front door they came through.
 */
function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionStuck, setSessionStuck] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (!result?.ok) {
      setLoading(false);
      // Deliberately vague: naming which half was wrong tells an attacker
      // which email addresses have accounts.
      setError("That email and password don't match an account.");
      return;
    }

    // The credentials call set the cookie, but the session has to be readable
    // before we navigate: leaving first can mount a guarded page while the
    // session is still unknown, and its guard bounces straight back here.
    const session = await getSession();
    if (!session?.user) {
      setLoading(false);
      setSessionStuck(true);
      return;
    }

    window.location.assign(await destination(params.get("next")));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08081a] px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Phone className="h-4 w-4 text-white" />
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
            <Input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.ie"
            />
          </Field>
          <Field label="Password" error={error ?? undefined}>
            <Input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Sign in
          </Button>

          <div className="flex items-center justify-between text-[13px]">
            <Link href="/forgot-password" className="text-slate-500 hover:text-slate-300">
              Forgot password?
            </Link>
            <Link href="/signup" className="text-indigo-400 hover:underline">
              Create an account
            </Link>
          </div>
        </form>

        {sessionStuck && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px]">
            <p className="font-medium text-amber-300">Your details were correct.</p>
            <p className="mt-1 leading-relaxed text-slate-300">
              The sign-in succeeded but the session could not be read back, so the dashboard would
              send you straight here again. That is a server configuration problem, not your
              password — usually a missing or mismatched{" "}
              <code className="text-slate-200">NEXTAUTH_SECRET</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Where this person should land, in order of what they actually asked for. */
async function destination(next: string | null): Promise<string> {
  // An explicit ?next= wins, but only for a path on this site — an absolute
  // URL here would be an open redirect.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;

  // Someone who picked a plan before signing in goes straight to checkout.
  try {
    const pendingPlan = sessionStorage.getItem("pendingPlan");
    if (pendingPlan) {
      sessionStorage.removeItem("pendingPlan");
      return "/settings";
    }
  } catch {
    // Private browsing blocks sessionStorage; fall through.
  }

  try {
    const response = await fetch("/api/v1/workspaces");
    if (response.ok) {
      const { workspaces } = (await response.json()) as { workspaces: unknown[] };
      if (Array.isArray(workspaces) && workspaces.length > 0) return "/app";
    }
  } catch {
    // If we cannot tell, the AIOS dashboard is the safe landing — it works for
    // every account, whereas /app would bounce someone with no workspace.
  }

  return "/dashboard";
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<Loading />}>
      <LoginForm />
    </Suspense>
  );
}
