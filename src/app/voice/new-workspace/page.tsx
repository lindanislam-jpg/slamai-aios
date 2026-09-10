"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Phone } from "lucide-react";
import { Button, Card, Field, Input, Select } from "@/components/voice/ui";
import { api, errorMessage } from "@/lib/voice/client";
import { INDUSTRIES } from "@/lib/voice/industries";
import { COUNTRIES, countryDefaults } from "@/lib/voice/hours";

/**
 * Reached when a signed-in user has no workspace — either they signed up
 * through the older AIOS app, or they are adding a second business.
 */
export default function NewWorkspacePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", industry: "plumbing", country: "IE", timezone: "Europe/Dublin" });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/workspaces", "POST", form);
      router.push("/app/onboarding");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/voice" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Phone className="h-4 w-4 text-white" />
          </span>
          <span className="text-[16px] font-semibold text-white">SlamAI Voice</span>
        </Link>

        <Card className="p-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Set up a workspace</h1>
          <p className="mt-1.5 text-[14px] text-slate-400">
            Each business gets its own workspace, with its own AI, numbers and data.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Field label="Business name" required>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABC Plumbing" />
            </Field>
            <Field label="What do you do?">
              <Select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                {INDUSTRIES.map((industry) => (
                  <option key={industry.key} value={industry.key}>{industry.icon} {industry.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Country">
              <Select
                value={form.country}
                onChange={(e) => {
                  const defaults = countryDefaults(e.target.value);
                  setForm({ ...form, country: e.target.value, timezone: defaults.timezone });
                }}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </Select>
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={saving}>
              Create workspace
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
