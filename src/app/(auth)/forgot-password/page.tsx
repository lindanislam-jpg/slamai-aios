"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Mail, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-3xl font-bold mb-2">Reset your password</h1>
          <p className="text-slate-400">We&apos;ll create a link you can use to set a new one.</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto">
                <MailCheck className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="font-semibold text-lg">Check for your link</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                If an account exists for <span className="text-slate-200">{email}</span>, a reset
                link has been created. It is valid for one hour and can be used once.
              </p>
              <p className="text-xs text-slate-500 border-t border-slam-border pt-4 leading-relaxed">
                Email delivery isn&apos;t connected yet, so the link is written to the server logs.
                The account owner can read it in the deployment&apos;s runtime logs.
              </p>
              <Link href="/login" className="btn-secondary inline-flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-slate-300 mb-1.5 block">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-field pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating link…</> : "Send reset link"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
