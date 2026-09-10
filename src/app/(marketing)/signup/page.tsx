"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { ArrowRight, Check, Phone } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/voice/ui";
import { INDUSTRIES } from "@/lib/voice/industries";
import { COUNTRIES, countryDefaults } from "@/lib/voice/hours";
import { errorMessage } from "@/lib/voice/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", password: "", businessName: "",
    industry: "plumbing", phone: "", country: "IE", timezone: "Europe/Dublin",
  });
  const [saving, setSaving] = useState(false);

  function setCountry(code: string) {
    const defaults = countryDefaults(code);
    setForm((f) => ({ ...f, country: code, timezone: defaults.timezone }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/v1/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create your account.");

      // Sign in straight away — a business owner should never have to type
      // their password twice in the first minute.
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        toast.success("Account created — please sign in.");
        router.push("/login");
        return;
      }

      router.push("/app/onboarding");
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-5 py-12 sm:px-10 lg:w-[55%] lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Phone className="h-4 w-4 text-white" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight text-white">SlamAI</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-400">Voice</span>
            </span>
          </Link>

          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
            Start answering every call
          </h1>
          <p className="mt-2 text-[14.5px] text-slate-400">
            Free for 14 days. No card. Live in under ten minutes.
          </p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <Field label="Business name" required>
              <Input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="ABC Plumbing"
              />
            </Field>

            <Field label="What do you do?" required hint="Sets your AI's starting instructions and services.">
              <Select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                {INDUSTRIES.map((industry) => (
                  <option key={industry.key} value={industry.key}>
                    {industry.icon} {industry.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Your name" required>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <Field label="Business email" required>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@abcplumbing.ie"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+353 87 123 4567" />
              </Field>
              <Field label="Country" required>
                <Select value={form.country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Password" required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              <Input
                required
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={saving}>
              Create my AI receptionist <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-center text-[13px] text-slate-500">
              Already with us?{" "}
              <Link href="/login" className="text-indigo-400 hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>

      <aside className="relative hidden lg:flex lg:w-[45%] lg:items-center lg:justify-center lg:border-l lg:border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 60% 30%, rgba(99,102,241,0.2), transparent)" }}
        />
        <div className="relative max-w-sm px-10">
          <h2 className="text-[24px] font-semibold leading-tight tracking-tight text-white">
            Your customers get an answer every time they call.
          </h2>
          <ul className="mt-7 space-y-4">
            {[
              "It answers on the first ring, day or night",
              "It takes the name, the number and the job",
              "It books the appointment into your calendar",
              "It puts urgent callers through to a person",
              "It never invents a price it wasn't given",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-slate-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-3 w-3 text-emerald-400" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
