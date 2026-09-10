"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Bot, Phone, Plus, Save, Sparkles, Trash2, Zap,
} from "lucide-react";
import Link from "next/link";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Field, Input, Loading, Modal,
  PageHeader, Select, StatusDot, Textarea, Toggle,
} from "@/components/voice/ui";
import { PERSONALITIES } from "@/lib/voice/personalities";
import { VOICE_OPTIONS, LANGUAGES } from "@/lib/voice/voices";
import { TRANSFER_TRIGGERS, parseTriggers } from "@/lib/voice/transfer-rules";

type Agent = {
  id: string; name: string; personality: string; voice: string; language: string;
  speakingRate: number; greeting: string; customInstructions: string | null;
  emergencyInstructions: string | null; afterHoursMode: string;
  bookingEnabled: boolean; leadCaptureEnabled: boolean; transferEnabled: boolean;
  transferNumber: string | null; fallbackNumber: string | null; transferTriggers: string;
  maxTurns: number; isActive: boolean; isDefault: boolean;
  phoneNumbers: { id: string; e164: string; status: string }[];
  _count: { calls: number };
};

const AFTER_HOURS = [
  { value: "answer", label: "Keep answering and booking as normal" },
  { value: "message", label: "Answer questions, then take a message" },
  { value: "emergency_only", label: "Handle emergencies, take a message otherwise" },
  { value: "voicemail", label: "Go straight to voicemail" },
];

export default function AgentsPage() {
  const { data, loading, error, refresh } = useApi<{ agents: Agent[] }>("/api/v1/agents");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const agents = data?.agents ?? [];
  const selected = agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;

  useEffect(() => {
    if (!selectedId && agents.length > 0) setSelectedId(agents[0].id);
  }, [agents, selectedId]);

  if (loading) return <Loading label="Loading your receptionists…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <>
      <PageHeader
        title="Your AI receptionist"
        description="How it sounds, what it says, and what it is allowed to do on a call."
        action={
          <div className="flex gap-2">
            <Link href="/app/test">
              <Button variant="secondary" icon={<Zap className="h-4 w-4" />}>Test it</Button>
            </Link>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New receptionist
            </Button>
          </div>
        }
      />

      {agents.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedId(agent.id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] transition-colors ${
                selected?.id === agent.id
                  ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                  : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              {agent.name}
              {agent.isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <AgentEditor agent={selected} onSaved={refresh} canDelete={agents.length > 1} />
      ) : (
        <Card className="px-6 py-16 text-center">
          <Bot className="mx-auto h-10 w-10 text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-white">No AI receptionists yet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
            Create your first AI receptionist in less than five minutes.
          </p>
          <Button className="mt-5" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Create AI receptionist
          </Button>
        </Card>
      )}

      <CreateAgentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setSelectedId(id);
          void refresh();
        }}
      />
    </>
  );
}

function AgentEditor({
  agent,
  onSaved,
  canDelete,
}: {
  agent: Agent;
  onSaved: () => void;
  canDelete: boolean;
}) {
  const [form, setForm] = useState(agent);
  const [triggers, setTriggers] = useState<string[]>(parseTriggers(agent.transferTriggers));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Switching between receptionists must reset the form to the new one.
  useEffect(() => {
    setForm(agent);
    setTriggers(parseTriggers(agent.transferTriggers));
  }, [agent]);

  const set = <K extends keyof Agent>(key: K, value: Agent[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const liveNumber = form.phoneNumbers.find((n) => n.status === "active");

  async function save(overrides: Partial<Agent> = {}) {
    setSaving(true);
    try {
      await api(`/api/v1/agents/${agent.id}`, "PATCH", {
        name: form.name,
        personality: form.personality,
        voice: form.voice,
        language: form.language,
        speakingRate: form.speakingRate,
        greeting: form.greeting,
        customInstructions: form.customInstructions ?? "",
        emergencyInstructions: form.emergencyInstructions ?? "",
        afterHoursMode: form.afterHoursMode,
        bookingEnabled: form.bookingEnabled,
        leadCaptureEnabled: form.leadCaptureEnabled,
        transferEnabled: form.transferEnabled,
        transferNumber: form.transferNumber ?? "",
        fallbackNumber: form.fallbackNumber ?? "",
        transferTriggers: triggers,
        maxTurns: form.maxTurns,
        ...overrides,
      });
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Identity" description="What the caller hears first." />
          <div className="space-y-4 p-5">
            <Field label="Receptionist name" hint="Only you see this — it labels the agent in your dashboard.">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sarah — AI Receptionist" />
            </Field>

            <Field
              label="Greeting"
              required
              hint="The first thing said on every call. Say the business name so callers know they reached the right place."
            >
              <Textarea
                value={form.greeting}
                onChange={(e) => set("greeting", e.target.value)}
                rows={2}
                placeholder="Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help?"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Voice">
                <Select value={form.voice} onChange={(e) => set("voice", e.target.value)}>
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} — {v.accent}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Language">
                <Select value={form.language} onChange={(e) => set("language", e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={`Speaking speed — ${form.speakingRate.toFixed(2)}×`} hint="Slower is clearer on a poor line.">
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={form.speakingRate}
                onChange={(e) => set("speakingRate", Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Personality" description="How it comes across to a caller." />
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {PERSONALITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => set("personality", p.key)}
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
        </Card>

        <Card>
          <CardHeader
            title="Your instructions"
            description="Anything specific about how you want calls handled."
          />
          <div className="space-y-4 p-5">
            <Field
              label="Business instructions"
              hint="These are followed unless they conflict with the safety rules — the AI will never invent prices or claim to be human."
            >
              <Textarea
                rows={5}
                value={form.customInstructions ?? ""}
                onChange={(e) => set("customInstructions", e.target.value)}
                placeholder={
                  "You are the receptionist for ABC Plumbing.\nBe friendly, professional and concise.\nNever quote a price for a job you haven't seen.\nWe don't cover areas outside County Dublin — offer to take details anyway."
                }
              />
            </Field>
            <Field label="Emergency procedure" hint="What to do when a caller has an emergency.">
              <Textarea
                rows={3}
                value={form.emergencyInstructions ?? ""}
                onChange={(e) => set("emergencyInstructions", e.target.value)}
                placeholder="Take their name, address and phone number immediately, tell them we'll be there within two hours, then transfer to the on-call number."
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="What it can do" description="Turn a capability off and the AI will not attempt it." />
          <div className="divide-y divide-white/[0.04] px-5 py-2">
            <Toggle
              label="Capture leads"
              description="Collect the caller's name, number and what they need, and file it in your leads."
              checked={form.leadCaptureEnabled}
              onChange={(v) => set("leadCaptureEnabled", v)}
            />
            <Toggle
              label="Book appointments"
              description="Offer real times from your calendar and book them, without double-booking."
              checked={form.bookingEnabled}
              onChange={(v) => set("bookingEnabled", v)}
            />
            <Toggle
              label="Transfer to a person"
              description="Put the caller through to a human when the rules below are met."
              checked={form.transferEnabled}
              onChange={(v) => set("transferEnabled", v)}
            />
          </div>

          {form.transferEnabled && (
            <div className="space-y-4 border-t border-white/[0.06] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Transfer to" hint="International format, e.g. +353871234567">
                  <Input
                    value={form.transferNumber ?? ""}
                    onChange={(e) => set("transferNumber", e.target.value)}
                    placeholder="+353871234567"
                  />
                </Field>
                <Field label="If nobody answers" hint="A second number to try. Leave blank to take a message instead.">
                  <Input
                    value={form.fallbackNumber ?? ""}
                    onChange={(e) => set("fallbackNumber", e.target.value)}
                    placeholder="+353871234568"
                  />
                </Field>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-medium text-slate-300">Transfer when…</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TRANSFER_TRIGGERS.map((t) => {
                    const on = triggers.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        onClick={() =>
                          setTriggers((cur) => (on ? cur.filter((k) => k !== t.key) : [...cur, t.key]))
                        }
                        className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          on ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <div className="text-[13px] font-medium text-slate-100">{t.label}</div>
                        <div className="mt-0.5 text-[12px] text-slate-400">{t.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Outside opening hours" description="Set your opening hours in Settings → Hours." />
          <div className="space-y-2 p-5">
            {AFTER_HOURS.map((option) => (
              <button
                key={option.value}
                onClick={() => set("afterHoursMode", option.value)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[13.5px] transition-colors ${
                  form.afterHoursMode === option.value
                    ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                    : "border-white/[0.07] bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    form.afterHoursMode === option.value ? "border-indigo-400 bg-indigo-500" : "border-slate-600"
                  }`}
                />
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <StatusDot active={form.isActive} label={form.isActive ? "Answering calls" : "Not answering"} />
            {form.isDefault && <Badge tone="brand">Default</Badge>}
          </div>

          <div className="mt-4 space-y-2 text-[13px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Number</span>
              <span className="font-medium text-slate-200">{liveNumber?.e164 ?? "Not connected"}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Calls handled</span>
              <span className="font-medium text-slate-200">{agent._count.calls}</span>
            </div>
          </div>

          {!liveNumber && (
            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-amber-200">
              Connect a phone number before switching this on, otherwise there is nothing for it to answer.{" "}
              <Link href="/app/settings?tab=phone" className="underline">Connect a number</Link>
            </p>
          )}

          <Button
            className="mt-4 w-full"
            variant={form.isActive ? "secondary" : "primary"}
            loading={saving}
            disabled={!liveNumber && !form.isActive}
            onClick={() => {
              set("isActive", !form.isActive);
              void save({ isActive: !form.isActive });
            }}
          >
            {form.isActive ? "Pause this receptionist" : "Switch it on"}
          </Button>
        </Card>

        <Card className="p-5">
          <Button className="w-full" loading={saving} icon={<Save className="h-4 w-4" />} onClick={() => save()}>
            Save changes
          </Button>
          <Link href="/app/test">
            <Button variant="secondary" className="mt-2 w-full" icon={<Sparkles className="h-4 w-4" />}>
              Try it out
            </Button>
          </Link>
          {canDelete && (
            <Button variant="danger" className="mt-2 w-full" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold text-slate-200">Safety rails</h3>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-slate-400">
            <li>• It never claims to be a person.</li>
            <li>• It never invents a price or a policy.</li>
            <li>• It only quotes from your services and knowledge base.</li>
            <li>• It tells callers to ring emergency services in a real emergency.</li>
          </ul>
          <p className="mt-3 text-[12px] text-slate-500">These cannot be turned off by instructions.</p>
        </Card>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this receptionist?"
        description="Its call history stays, but it will stop answering immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/api/v1/agents/${agent.id}`, "DELETE");
                  toast.success("Deleted");
                  setConfirmDelete(false);
                  onSaved();
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Any phone number pointed at it will stop being answered by AI until you connect another.
        </p>
      </Modal>
    </div>
  );
}

function CreateAgentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("professional_friendly");
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New AI receptionist"
      description="You can change everything about it afterwards."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const result = await api<{ agent: { id: string } }>("/api/v1/agents", "POST", {
                  name: name.trim() || "AI Receptionist",
                  personality,
                });
                toast.success("Created");
                onCreated(result.agent.id);
                setName("");
                onClose();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name it" hint="Only visible to you.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah — Sales line" />
        </Field>
        <Field label="Personality">
          <Select value={personality} onChange={(e) => setPersonality(e.target.value)}>
            {PERSONALITIES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
