"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, PhoneCall } from "lucide-react";
import MarketingNav from "@/components/voice/MarketingNav";
import MarketingFooter from "@/components/voice/MarketingFooter";
import DemoConversation from "@/components/voice/DemoConversation";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/voice/ui";
import { INDUSTRIES } from "@/lib/voice/industries";
import { errorMessage } from "@/lib/voice/client";

export default function DemoPage() {
  const [form, setForm] = useState({
    name: "", businessName: "", email: "", phone: "", industry: "plumbing", message: "",
  });
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send that just now.");
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MarketingNav />

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-[42px]">
              See it handle a real call
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-400">
              Below is exactly how SlamAI Voice handles an emergency call — establish urgency, take the address,
              offer a real appointment slot. On the right, tell us about your business and we&apos;ll walk you through
              it on your own numbers.
            </p>

            <div className="mt-8">
              <DemoConversation />
            </div>

            <div className="mt-8 rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <PhoneCall className="h-4 w-4 text-indigo-400" />
                Or skip the demo entirely
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">
                Start the free trial and test your own AI in your dashboard in under ten minutes. No card needed.
              </p>
              <Link href="/voice/signup">
                <Button className="mt-4">Start free instead</Button>
              </Link>
            </div>
          </div>

          <div>
            <Card className="p-6">
              {sent ? (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h2 className="mt-4 text-[18px] font-semibold text-white">Got it — thank you</h2>
                  <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-slate-400">
                    We&apos;ll be in touch shortly to arrange a walkthrough. If you&apos;d rather not wait, the free
                    trial takes ten minutes and needs no card.
                  </p>
                  <Link href="/voice/signup">
                    <Button className="mt-5">Start free now</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <h2 className="text-[20px] font-semibold text-white">Book a demo</h2>
                  <p className="mt-1 text-[13.5px] text-slate-400">
                    Tell us about your business and we&apos;ll show you what your AI would say.
                  </p>

                  <form className="mt-6 space-y-4" onSubmit={submit}>
                    <Field label="Your name" required>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </Field>
                    <Field label="Business name" required>
                      <Input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
                    </Field>
                    <Field label="Email" required>
                      <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </Field>
                    <Field label="Phone">
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </Field>
                    <Field label="What do you do?">
                      <Select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                        {INDUSTRIES.map((industry) => (
                          <option key={industry.key} value={industry.key}>{industry.icon} {industry.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Anything we should know?" error={error ?? undefined}>
                      <Textarea
                        rows={3}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="We get about 40 calls a day and miss maybe a third of them."
                      />
                    </Field>

                    <Button type="submit" size="lg" className="w-full" loading={saving}>
                      Request a demo
                    </Button>
                    <p className="text-center text-[12.5px] text-slate-500">
                      We&apos;ll only use these details to contact you about SlamAI Voice.
                    </p>
                  </form>
                </>
              )}
            </Card>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
