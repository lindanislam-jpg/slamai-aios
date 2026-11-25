"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Plug, Plus, Trash2, Webhook } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, CopyButton, ErrorState, Field, Input, Loading, Modal,
} from "../ui";
import { EVENTS, EVENT_LABELS } from "@/lib/voice/events";

type Endpoint = {
  id: string; name: string; url: string; events: string; isActive: boolean;
  lastStatus: number | null; lastFiredAt: string | null; failureCount: number;
};

/** Integrations we plan to ship. Shown so nobody wires up something that isn't live. */
const PLANNED = [
  { name: "Google Calendar", note: "Two-way appointment sync" },
  { name: "Microsoft 365", note: "Outlook calendar sync" },
  { name: "HubSpot", note: "Push leads to your CRM" },
  { name: "Salesforce", note: "Push leads to your CRM" },
  { name: "GoHighLevel", note: "Push leads and contacts" },
  { name: "Slack", note: "Post new leads to a channel" },
  { name: "WhatsApp", note: "Follow up by message" },
  { name: "Zapier", note: "Connect to 6,000 apps" },
];

export default function IntegrationSettings() {
  const { data, loading, error, refresh } = useApi<{ endpoints: Endpoint[]; enabled: boolean }>(
    "/api/v1/webhook-endpoints"
  );
  const [adding, setAdding] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  async function remove(id: string) {
    try {
      await api(`/api/v1/webhook-endpoints/${id}`, "DELETE");
      toast.success("Removed");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Webhooks — connect SlamAI to anything"
          description="Send every call, lead and booking straight into n8n, Zapier, your CRM or your own system."
          action={
            <Button size="sm" disabled={!data.enabled} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
              Add endpoint
            </Button>
          }
        />

        {!data.enabled && (
          <div className="border-b border-white/[0.06] bg-amber-500/[0.06] px-5 py-3 text-[13px] text-amber-200">
            Webhooks are on the Business plan and above.
          </div>
        )}

        {data.endpoints.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Webhook className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-[13px] text-slate-400">No endpoints yet.</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-slate-500">
              A typical setup: call ends → SlamAI webhook → n8n → your CRM, a Slack message and a Google Sheet row.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.endpoints.map((endpoint) => (
              <div key={endpoint.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-slate-200">{endpoint.name}</span>
                    <Badge tone={endpoint.isActive ? "success" : "neutral"}>
                      {endpoint.isActive ? "Active" : "Paused"}
                    </Badge>
                    {endpoint.failureCount > 0 && <Badge tone="danger">{endpoint.failureCount} failures</Badge>}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[12px] text-slate-500">{endpoint.url}</div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {JSON.parse(endpoint.events || "[]").length === 0
                      ? "All events"
                      : `${JSON.parse(endpoint.events).length} events`}
                    {endpoint.lastFiredAt && ` · last fired ${new Date(endpoint.lastFiredAt).toLocaleString("en-GB")}`}
                    {endpoint.lastStatus !== null && ` · HTTP ${endpoint.lastStatus}`}
                  </div>
                </div>
                <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(endpoint.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.06] px-5 py-4">
          <h3 className="text-[13px] font-semibold text-slate-200">How to verify a delivery</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
            Every request carries <code className="font-mono text-slate-300">X-SlamAI-Timestamp</code> and{" "}
            <code className="font-mono text-slate-300">X-SlamAI-Signature</code>. The signature is{" "}
            <code className="font-mono text-slate-300">sha256=HMAC(secret, &quot;timestamp.body&quot;)</code>. Reject
            anything older than five minutes. Full worked examples, including an n8n flow, are in{" "}
            <span className="font-mono">docs/N8N_INTEGRATION.md</span>.
          </p>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Direct integrations"
          description="Not built yet — use a webhook into n8n or Zapier in the meantime, which reaches all of these today."
        />
        <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4">
          {PLANNED.map((integration) => (
            <div key={integration.name} className="bg-[#15152b] px-5 py-4">
              <div className="flex items-center gap-2">
                <Plug className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[13.5px] font-medium text-slate-300">{integration.name}</span>
              </div>
              <div className="mt-1 text-[12px] text-slate-500">{integration.note}</div>
              <Badge className="mt-2" tone="neutral">Planned</Badge>
            </div>
          ))}
        </div>
      </Card>

      <AddEndpointModal open={adding} onClose={() => setAdding(false)} onAdded={refresh} />
    </>
  );
}

function AddEndpointModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  function close() {
    setSecret(null);
    setName("");
    setUrl("");
    setSelected([]);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="New webhook endpoint"
      description="We'll POST a signed JSON payload here whenever these events happen."
      footer={
        secret ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button
              loading={saving}
              disabled={!url.trim() || !name.trim()}
              onClick={async () => {
                setSaving(true);
                try {
                  const result = await api<{ secret: string }>("/api/v1/webhook-endpoints", "POST", {
                    name: name.trim(),
                    url: url.trim(),
                    events: selected,
                    isActive: true,
                  });
                  setSecret(result.secret);
                  onAdded();
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
        )
      }
    >
      {secret ? (
        <div className="space-y-3">
          <p className="text-[13.5px] text-slate-300">
            Copy this signing secret now. It is not shown again — if you lose it, delete the endpoint and make a new one.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <code className="block break-all font-mono text-[12.5px] text-emerald-300">{secret}</code>
          </div>
          <CopyButton value={secret} label="Copy secret" />
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Name it" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="n8n — lead pipeline" />
          </Field>
          <Field label="URL" required hint="Must be publicly reachable over https.">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://n8n.yourdomain.com/webhook/slamai" />
          </Field>
          <div>
            <div className="mb-2 text-[13px] font-medium text-slate-300">
              Events <span className="font-normal text-slate-500">(none selected sends everything)</span>
            </div>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {EVENTS.map((event) => {
                const on = selected.includes(event);
                return (
                  <button
                    key={event}
                    onClick={() => setSelected((s) => (on ? s.filter((e) => e !== event) : [...s, event]))}
                    className={`rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors ${
                      on ? "border-indigo-500/50 bg-indigo-500/10 text-white" : "border-white/[0.07] bg-white/[0.02] text-slate-400"
                    }`}
                  >
                    {EVENT_LABELS[event]}
                    <div className="font-mono text-[11px] text-slate-600">{event}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
