"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Phone, Plus, Search, Trash2 } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, CopyButton, EmptyState, ErrorState, Field,
  Input, Loading, Modal, Select, Table, Td, Th,
} from "../ui";

type PhoneNumber = {
  id: string; e164: string; label: string | null; status: string; provider: string;
  forwardTo: string | null;
  agent: { id: string; name: string; isActive: boolean } | null;
};

type NumbersData = {
  numbers: PhoneNumber[];
  providerConfigured: boolean;
  provider: string;
  webhookUrl: string;
};

type Agent = { id: string; name: string };

export default function PhoneSettings() {
  const { data, loading, error, refresh } = useApi<NumbersData>("/api/v1/phone-numbers");
  const { data: agentData } = useApi<{ agents: Agent[] }>("/api/v1/agents");
  const [adding, setAdding] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  async function remove(id: string) {
    try {
      await api(`/api/v1/phone-numbers/${id}`, "DELETE");
      toast.success("Disconnected");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function assign(id: string, agentId: string) {
    try {
      await api(`/api/v1/phone-numbers/${id}`, "PATCH", { agentId: agentId || null });
      toast.success("Updated");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      {!data.providerConfigured && (
        <Card className="mb-4 border-amber-500/25 bg-amber-500/[0.06] p-5">
          <h3 className="text-[14px] font-semibold text-amber-100">No telephony provider connected</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-200/90">
            Buying and connecting numbers needs provider credentials on the server. Until then you can still register
            a number here manually and point it at SlamAI yourself.
          </p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your voice webhook URL</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-slate-300">{data.webhookUrl}</code>
              <CopyButton value={data.webhookUrl} />
            </div>
          </div>
          <p className="mt-2 text-[12px] text-amber-200/70">
            Full instructions are in <span className="font-mono">docs/VOICE_PROVIDER_SETUP.md</span>.
          </p>
        </Card>
      )}

      {data.numbers.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-6 w-6" />}
          title="No phone number connected"
          description="Your AI needs a number to answer. Buy one here in a few seconds, or point a number you already own at SlamAI."
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Connect a number</Button>}
        />
      ) : (
        <Card>
          <CardHeader
            title="Phone numbers"
            description="Calls to these numbers are answered by the receptionist you assign."
            action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>Add</Button>}
          />
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Answered by</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.numbers.map((number) => (
                <tr key={number.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <div className="font-mono font-medium text-slate-200">{number.e164}</div>
                    {number.label && <div className="text-[12px] text-slate-500">{number.label}</div>}
                  </Td>
                  <Td>
                    <Select
                      value={number.agent?.id ?? ""}
                      onChange={(e) => assign(number.id, e.target.value)}
                      className="w-auto min-w-[170px] py-1.5 text-[13px]"
                      aria-label={`Receptionist for ${number.e164}`}
                    >
                      <option value="">Nobody — calls not answered</option>
                      {(agentData?.agents ?? []).map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Badge tone={number.status === "active" ? "success" : "warning"}>
                      {number.status === "active" ? "Live" : "Needs setup"}
                    </Badge>
                    {number.agent && !number.agent.isActive && (
                      <div className="mt-1 text-[11.5px] text-amber-400">Receptionist is paused</div>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" aria-label="Disconnect" onClick={() => remove(number.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <AddNumberModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={refresh}
        providerConfigured={data.providerConfigured}
      />
    </>
  );
}

function AddNumberModal({
  open,
  onClose,
  onAdded,
  providerConfigured,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  providerConfigured: boolean;
}) {
  const [mode, setMode] = useState<"buy" | "connect">(providerConfigured ? "buy" : "connect");
  const [country, setCountry] = useState("IE");
  const [available, setAvailable] = useState<{ e164: string; friendlyName?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function search() {
    setSearching(true);
    try {
      const result = await fetch(`/api/v1/phone-numbers/search?country=${country}`);
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setAvailable(payload.numbers);
      if (payload.numbers.length === 0) toast("No numbers available in that country right now.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function add(e164: string, purchase: boolean) {
    setSaving(true);
    try {
      await api("/api/v1/phone-numbers", "POST", {
        e164,
        label,
        mode: purchase ? "purchase" : "connect",
      });
      toast.success(purchase ? "Number bought and connected" : "Number connected");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Connect a phone number"
      description="This is the number your customers ring."
    >
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode("buy")}
          disabled={!providerConfigured}
          className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
            mode === "buy" ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.07] bg-white/[0.02]"
          }`}
        >
          <div className="text-[13.5px] font-medium text-slate-100">Buy a new number</div>
          <div className="mt-0.5 text-[12px] text-slate-400">Live in seconds. Forward your existing line to it.</div>
        </button>
        <button
          onClick={() => setMode("connect")}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            mode === "connect" ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.07] bg-white/[0.02]"
          }`}
        >
          <div className="text-[13.5px] font-medium text-slate-100">Use a number I own</div>
          <div className="mt-0.5 text-[12px] text-slate-400">Point it at SlamAI from your provider.</div>
        </button>
      </div>

      <Field label="Label (optional)" className="mb-4">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main line" />
      </Field>

      {mode === "buy" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={country} onChange={(e) => setCountry(e.target.value)} className="w-auto">
              <option value="IE">Ireland</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="AU">Australia</option>
              <option value="CA">Canada</option>
            </Select>
            <Button variant="secondary" loading={searching} icon={<Search className="h-4 w-4" />} onClick={search}>
              Find numbers
            </Button>
          </div>

          {available.length > 0 && (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {available.map((number) => (
                <div key={number.e164} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="font-mono text-[13.5px] text-slate-200">{number.e164}</span>
                  <Button size="sm" loading={saving} onClick={() => add(number.e164, true)}>Buy this</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Field
            label="Your number"
            required
            hint="International format. It must already be on the provider account, or you must forward it there."
          >
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="+353871234567" />
          </Field>
          <Button className="w-full" loading={saving} disabled={!manual.trim()} onClick={() => add(manual.trim(), false)}>
            Connect this number
          </Button>
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            If your number lives with another carrier, forward it to a SlamAI number instead — that works with any
            provider and takes two minutes. See <span className="font-mono">docs/VOICE_PROVIDER_SETUP.md</span>.
          </p>
        </div>
      )}
    </Modal>
  );
}
