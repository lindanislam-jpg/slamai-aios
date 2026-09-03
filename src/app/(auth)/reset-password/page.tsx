"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Lock, Eye, EyeOff, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { MIN_PASSWORD_LENGTH } from "@/lib/utils";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not reset your password");
        return;
      }
      toast.success("Password updated — sign in with it now");
      router.push("/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6 text-yellow-400" />
        </div>
        <h2 className="font-semibold text-lg">This link is incomplete</h2>
        <p className="text-sm text-slate-400">
          It&apos;s missing its reset token. Request a fresh link and use the whole URL.
        </p>
        <Link href="/forgot-password" className="btn-primary inline-block text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-slate-300 mb-1.5 block">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="input-field pl-10 pr-10"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className={`text-xs mt-1.5 ${tooShort ? "text-red-400" : "text-slate-600"}`}>
            At least {MIN_PASSWORD_LENGTH} characters. Use something you don&apos;t use anywhere else.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="text-sm font-medium text-slate-300 mb-1.5 block">
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••••••"
              className="input-field pl-10"
              required
            />
          </div>
          {mismatch && <p className="text-xs text-red-400 mt-1.5">The two passwords don&apos;t match.</p>}
        </div>

        <button
          type="submit"
          disabled={!ready || loading}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Set new password"}
        </button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">SlamAI <span className="text-brand-400">AIOS</span></span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Choose a new password</h1>
          <p className="text-slate-400">This link works once, and expires an hour after it was made.</p>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
