"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionStuck, setSessionStuck] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });

    if (!res?.ok) {
      setLoading(false);
      toast.error("Invalid email or password");
      return;
    }

    // The credentials call set the cookie, but the session has to be readable
    // before we leave: navigating first can mount the dashboard while the
    // session is still unknown, and its guard then bounces straight back here.
    const session = await getSession();
    setLoading(false);

    if (!session?.user) {
      toast.error("Signed in, but your session could not be read back.");
      setSessionStuck(true);
      return;
    }

    toast.success("Welcome back!");

    // If they picked a plan before signing up, take them straight to checkout.
    let pendingPlan: string | null = null;
    try {
      pendingPlan = sessionStorage.getItem("pendingPlan");
      if (pendingPlan) sessionStorage.removeItem("pendingPlan");
    } catch { /* private mode — skip */ }

    // A full navigation rather than a client-side push, so the next page starts
    // from a clean load with the session cookie already in place.
    window.location.assign(pendingPlan ? "/settings" : "/dashboard");
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
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-slate-400">Sign in to your AI operating system</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  required
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
            </button>
          </form>

          {sessionStuck && (
            <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
              <p className="text-yellow-300 font-medium mb-1">Your details were correct.</p>
              <p className="text-slate-300 leading-relaxed">
                The sign-in succeeded but the session could not be read back, so the dashboard
                would send you straight here again. This is a server configuration problem, not
                your password — usually a missing or mismatched <code className="text-slate-200">AUTH_SECRET</code>.
              </p>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Start your free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
