"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Field, Input, Loading, Modal, Select,
} from "../ui";
import { EVENTS, EVENT_LABELS, type EventKey } from "@/lib/voice/events";

type Rule = { id: string; event: string; channel: string; target: string; isActive: boolean };
type Log = { id: string; event: string; channel: string; target: string; status: string; error: string | null; createdAt: string };

export default function NotificationSettings() {
  const { data, loading, error, refresh } = useApi<{
    rules: Rule[]; recent: Log[]; transports: { email: boolean; sms: boolean; webhook: boolean };
  }>("/api/v1/notifications");
  const [adding, setAdding] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  async function remove(id: string) {
    try {
      await api(`/api/v1/notifications/${id}`, "DELETE");
      toast.success("Turned off");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const missing = [
    !data.transports.email && "email (set RESEND_API_KEY)",
    !data.transports.sms && "SMS (set NOTIFICATION_SMS_FROM)",
  ].filter(Boolean);

  return (
    <>
      {missing.length > 0 && (
        <Card className="mb-4 border-amber-500/25 bg-amber-500/[0.06] p-4 text-[13px] leading-relaxed text-amber-200">
          These channels aren&apos;t configured on this deployment yet: {missing.join(", ")}. Rules using them are
          recorded as skipped rather than reported as sent.
        </Card>
      )}

      <Card>
        <CardHeader
          title="Tell me when…"
          description="Get an email, a text or a webhook the moment something happens."
          action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>Add</Button>}
        />
        {data.rules.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-[13px] text-slate-400">
              No notifications set up. Most businesses start with an email for every new lead.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-[13.5px] text-slate-200">
                    {EVENT_LABELS[rule.event as EventKey] ?? rule.event}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-slate-500">
                    <Badge tone="neutral">{rule.channel}</Badge>
                    <span className="truncate">{rule.target}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(rule.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.recent.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Recently sent" description="The last twenty attempts." />
          <div className="divide-y divide-white/[0.04]">
            {data.recent.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <span className="text-slate-300">{EVENT_LABELS[log.event as EventKey] ?? log.event}</span>
                  <span className="ml-2 truncate text-slate-500">{log.target}</span>
                  {log.error && <div className="text-[12px] text-rose-400">{log.error}</div>}
                </div>
                <Badge tone={log.status === "sent" ? "success" : log.status === "failed" ? "danger" : "warning"}>
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AddRuleModal open={adding} onClose={() => setAdding(false)} onAdded={refresh} />
    </>
  );
}

function AddRuleModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [event, setEvent] = useState<string>("lead.created");
  const [channel, setChannel] = useState("email");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New notification"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            disabled={!target.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await api("/api/v1/notifications", "POST", { event, channel, target: target.trim(), isActive: true });
                toast.success("Added");
                setTarget("");
                onAdded();
                onClose();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="When this happens">
          <Select value={event} onChange={(e) => setEvent(e.target.value)}>
            {EVENTS.map((key) => (
              <option key={key} value={key}>{EVENT_LABELS[key]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Send it by">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="email">Email</option>
            <option value="sms">Text message</option>
            <option value="webhook">Webhook</option>
          </Select>
        </Field>
        <Field
          label={channel === "email" ? "Email address" : channel === "sms" ? "Mobile number" : "Webhook URL"}
          required
        >
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={
              channel === "email" ? "you@business.ie" : channel === "sms" ? "+353871234567" : "https://example.com/hook"
            }
          />
        </Field>
      </div>
    </Modal>
  );
}
