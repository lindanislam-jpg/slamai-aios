"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import { Button, Card, CardHeader, ErrorState, Field, Input, Loading, Select, Textarea } from "../ui";
import { INDUSTRIES } from "@/lib/voice/industries";
import { COMMON_TIMEZONES, COUNTRIES } from "@/lib/voice/hours";

type Business = {
  id: string; name: string; industry: string; description: string | null; website: string | null;
  email: string | null; phone: string | null; addressLine: string | null; city: string | null;
  postcode: string | null; country: string; timezone: string; currency: string;
};

export default function BusinessSettings() {
  const { data, loading, error, refresh } = useApi<{ business: Business; role: string }>("/api/v1/business");
  const [form, setForm] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.business) setForm(data.business);
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!form) return null;

  const set = <K extends keyof Business>(key: K, value: Business[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api("/api/v1/business", "PATCH", {
        name: form.name,
        industry: form.industry,
        description: form.description ?? "",
        website: form.website ?? "",
        email: form.email ?? "",
        phone: form.phone ?? "",
        addressLine: form.addressLine ?? "",
        city: form.city ?? "",
        postcode: form.postcode ?? "",
        country: form.country,
        timezone: form.timezone,
        currency: form.currency,
      });
      toast.success("Saved");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Your business"
        description="Your AI uses these details on calls, so keep them accurate."
        action={<Button loading={saving} size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={save}>Save</Button>}
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Business name" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Trade" hint="Sets the defaults your AI uses — urgency words, typical services.">
          <Select value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>{i.icon} {i.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="What you do" className="sm:col-span-2" hint="One or two sentences. Your AI can use this to describe you.">
          <Textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Family-run plumbing and heating firm covering Dublin and Kildare since 2009. Gas Safe registered."
          />
        </Field>
        <Field label="Website">
          <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://yourbusiness.ie" />
        </Field>
        <Field label="Business email">
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Main phone">
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Address">
          <Input value={form.addressLine ?? ""} onChange={(e) => set("addressLine", e.target.value)} />
        </Field>
        <Field label="Town or city">
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Postcode / Eircode">
          <Input value={form.postcode ?? ""} onChange={(e) => set("postcode", e.target.value)} />
        </Field>
        <Field label="Country">
          <Select value={form.country} onChange={(e) => set("country", e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Timezone" hint="Every call time and appointment is shown in this timezone.">
          <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Card>
  );
}
