"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, User, Eye, EyeOff, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

export default function RegisterPage() {
  const router = useRouter();
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await axios.post("/api/auth/register", { name, email, password });
      toast.success("Account created! Please sign in.");
      router.push("/login");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Registration failed";
      toast.error(msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const strength = password.length >= 8 ? (password.match(/[A-Z]/) && password.match(/[0-9]/) ? "strong" : "medium") : password.length > 0 ? "weak" : "";

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">SlamAI <span className="text-brand-400">AIOS</span></span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Start your free trial</h1>
          <p className="text-slate-400">14 days free · No credit card required</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" className="input-field pl-10" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="input-field pl-10" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" className="input-field pl-10 pr-10" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {strength && (
                <div className="mt-2 flex gap-1">
                  {["weak","medium","strong"].map((s, i) => (
                    <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
                      strength === "weak"   && i === 0 ? "bg-red-500" :
                      strength === "medium" && i <= 1  ? "bg-yellow-500" :
                      strength === "strong"             ? "bg-green-500" :
                      "bg-slam-border"
                    }`} />
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Free Account"}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            {["14-day free trial, cancel anytime", "No credit card required", "Full platform access"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-slate-500">
                <Check className="w-3.5 h-3.5 text-green-400" /> {f}
              </div>
            ))}
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
