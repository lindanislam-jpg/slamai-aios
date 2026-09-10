"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  BookOpen, Building2, Check, ChevronLeft, ChevronRight, Clock, Phone, Rocket,
  Sparkles, Wrench,
} from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, Field, Input, Loading, Select, Textarea,
} from "@/components/voice/ui";
import BusinessSettings from "@/components/voice/settings/BusinessSettings";
import HoursSettings from "@/components/voice/settings/HoursSettings";
import ServicesSettings from "@/components/voice/settings/ServicesSettings";
import PhoneSettings from "@/components/voice/settings/PhoneSettings";
import { PERSONALITIES } from "@/lib/voice/personalities";
import { VOICE_OPTIONS } from "@/lib/voice/voices";

/**
 * The setup wizard. Each step reuses the same component the settings page
 * uses, so there is one implementation of "edit your services" rather than a
 * simplified wizard copy that drifts.
 */
const STEPS = [
  { key: "business", title: "Your business", description: "The basics your AI needs to answer for you.", icon: Building2 },
  { key: "hours", title: "When you're open", description: "So it knows how to handle an evening call.", icon: Clock },
  { key: "services", title: "What you do", description: "The only prices your AI will ever quote.", icon: Wrench },
  { key: "agent", title: "How it sounds", description: "Pick a voice and a manner.", icon: Sparkles },
  { key: "knowledge", title: "What it knows", description: "Point it at your website and it reads your pages.", icon: BookOpen },
  { key: "phone", title: "Your phone number", description: "The number your customers ring.", icon: Phone },
  { key: "launch", title: "Go live", description: "Try it, then switch it on.", icon: Rocket },
];

type Agent = { id: string; name: string; greeting: string; personality: string; voice: string; isActive: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { data } = useApi<{ business: { onboardingStep: number; onboardingCompleted: boolean } }>("/api/v1/business");

  useEffect(() => {
    if (data?.business && !data.business.onboardingCompleted) {
      setStep(Math.min(data.business.onboardingStep, STEPS.length - 1));
    }
  }, [data]);

  async function goTo(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await api("/api/v1/onboarding", "PATCH", { step: next }).catch(() => undefined);
  }

  async function finish() {
    try {
      await api("/api/v1/onboarding", "PATCH", { step: STEPS.length - 1, completed: true });
      toast.success("You're live. Your AI is ready to answer.");
      router.push("/app");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-indigo-300">
            Step {step + 1} of {STEPS.length}
          </span>
          <Link href="/app" className="text-[13px] text-slate-500 hover:text-slate-300">
            Finish this later
          </Link>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/5 text-indigo-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{current.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{current.description}</p>
        </div>
      </div>

      <div className="mb-6">
        {current.key === "business" && <BusinessSettings />}
        {current.key === "hours" && <HoursSettings />}
        {current.key === "services" && <ServicesSettings />}
        {current.key === "agent" && <AgentStep />}
        {current.key === "knowledge" && <KnowledgeStep />}
        {current.key === "phone" && <PhoneSettings />}
        {current.key === "launch" && <LaunchStep />}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={step === 0}
          icon={<ChevronLeft className="h-4 w-4" />}
          onClick={() => goTo(step - 1)}
        >
          Back
        </Button>
        {step === STEPS.length - 1 ? (
          <Button size="lg" icon={<Rocket className="h-4 w-4" />} onClick={finish}>
            Launch my AI receptionist
          </Button>
        ) : (
          <Button onClick={() => goTo(step + 1)}>
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AgentStep() {
  const { data, loading, refresh } = useApi<{ agents: Agent[] }>("/api/v1/agents");
  const agent = data?.agents[0];
  const [form, setForm] = useState<{ name: string; greeting: string; personality: string; voice: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent && !form) {
      setForm({ name: agent.name, greeting: agent.greeting, personality: agent.personality, voice: agent.voice });
    }
  }, [agent, form]);

  if (loading || !form || !agent) return <Loading />;

  async function save() {
    if (!agent || !form) return;
    setSaving(true);
    try {
      await api(`/api/v1/agents/${agent.id}`, "PATCH", form);
      toast.success("Saved");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="space-y-4">
        <Field label="Give it a name" hint="Only you see this.">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>

        <Field label="What it says when it answers" required>
          <Textarea rows={2} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
        </Field>

        <Field label="Voice">
          <Select value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })}>
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>{v.label} — {v.accent}</option>
            ))}
          </Select>
        </Field>

        <div>
          <div className="mb-2 text-[13px] font-medium text-slate-300">How should it come across?</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERSONALITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => setForm({ ...form, personality: p.key })}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  form.personality === p.key
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="text-[13.5px] font-medium text-slate-100">{p.label}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-slate-400">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        <Button loading={saving} onClick={save}>Save</Button>
      </div>
    </Card>
  );
}

function KnowledgeStep() {
  const { data, refresh } = useApi<{ sources: { id: string; title: string; status: string; chunkCount: number }[] }>(
    "/api/v1/knowledge"
  );
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  async function addUrl() {
    setSaving("url");
    try {
      await api("/api/v1/knowledge", "POST", {
        title: url.replace(/^https?:\/\//, "").slice(0, 60),
        type: "url",
        sourceUrl: url.trim(),
      });
      toast.success("Read and indexed");
      setUrl("");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  async function addText() {
    setSaving("text");
    try {
      await api("/api/v1/knowledge", "POST", { title: "Business information", type: "text", content: text });
      toast.success("Saved");
      setText("");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Field label="Your website" hint="We read the page text. Add your services and about pages too.">
          <div className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourbusiness.ie" />
            <Button loading={saving === "url"} disabled={!url.trim()} onClick={addUrl}>Read it</Button>
          </div>
        </Field>
      </Card>

      <Card className="p-5">
        <Field label="Or just type what your AI should know" hint="Areas you cover, call-out fees, what you don't do.">
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "We cover Dublin, Kildare and Meath.\nCall-out fee is €60 and comes off the final bill.\nWe don't work on commercial boilers.\nEmergency cover is 7am to 11pm, seven days."
            }
          />
        </Field>
        <Button className="mt-3" loading={saving === "text"} disabled={!text.trim()} onClick={addText}>
          Save this
        </Button>
      </Card>

      {(data?.sources.length ?? 0) > 0 && (
        <Card className="p-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Your AI has learned
          </div>
          <div className="space-y-1.5">
            {data?.sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 text-slate-300">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  {source.title}
                </span>
                <span className="text-slate-500">{source.chunkCount} passages</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LaunchStep() {
  const { data } = useApi<{ checklist: { knowledge: boolean; services: boolean; phone: boolean; agentLive: boolean } }>(
    "/api/v1/dashboard"
  );

  const checks = [
    { done: data?.checklist.services, label: "Your services are set up" },
    { done: data?.checklist.knowledge, label: "Your AI knows about your business" },
    { done: data?.checklist.phone, label: "A phone number is connected" },
    { done: data?.checklist.agentLive, label: "Your receptionist is switched on" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-white">Where you&apos;re at</h3>
        <div className="mt-3 space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2.5 text-[13.5px]">
              {check.done ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-600" />
              )}
              <span className={check.done ? "text-slate-400" : "text-slate-200"}>{check.label}</span>
              {!check.done && <Badge tone="warning">To do</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.09] to-transparent p-5">
        <h3 className="text-[15px] font-semibold text-white">Hear it before your customers do</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-300">
          The test console runs the exact same AI your callers get — same knowledge, same rules, same booking. Ask it
          a price it doesn&apos;t know and watch it offer a callback instead of guessing.
        </p>
        <Link href="/app/test">
          <Button className="mt-4" icon={<Sparkles className="h-4 w-4" />}>Test my AI</Button>
        </Link>
      </Card>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-white">Then switch it on</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-300">
          Go to your receptionist and hit &quot;Switch it on&quot;. From that moment every call to your connected number
          is answered — day, night and Sunday.
        </p>
        <Link href="/app/agents">
          <Button variant="secondary" className="mt-4">Open my receptionist</Button>
        </Link>
      </Card>
    </div>
  );
}
