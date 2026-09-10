"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Phone, Plus, Search, Users } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, Input, Loading, Modal,
  PageHeader, Pager, Select, Table, Td, Textarea, Th,
} from "@/components/voice/ui";
import { formatDate } from "@/lib/utils";
import { bandFor, BAND_LABELS } from "@/lib/voice/scoring";
import { LEAD_STATUSES, labelFor, toneFor } from "@/lib/voice/labels";

type Lead = {
  id: string; name: string | null; phone: string | null; email: string | null;
  company: string | null; serviceRequested: string | null; summary: string | null;
  score: number; status: string; source: string; estimatedValue: number | null;
  urgency: string; notes: string | null; createdAt: string; lastInteractionAt: string;
  call: { id: string; startedAt: string; durationSec: number } | null;
};

export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);

  const url = `/api/v1/leads?page=${page}&status=${status}&band=${band}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const { data, loading, error, refresh } = useApi<{
    items: Lead[]; total: number; page: number; pageCount: number;
  }>(url);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone your AI captured on a call, scored so you know who to ring back first."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Add a lead</Button>}
      />

      <Card className="mb-4 p-3">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, number, email or service" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto min-w-[150px]">
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Select value={band} onChange={(e) => { setBand(e.target.value); setPage(1); }} className="w-auto min-w-[130px]">
            <option value="all">All scores</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">🟠 Warm</option>
            <option value="cold">🔵 Cold</option>
          </Select>
        </form>
      </Card>

      {loading ? (
        <Loading label="Loading leads…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={query || status !== "all" ? "No leads match that" : "No leads yet"}
          description={
            query || status !== "all"
              ? "Try a different search or clear the filters."
              : "Every time your AI takes a caller's details, the lead appears here scored from 0 to 100 so you know who to call back first."
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Lead</Th>
                <Th>Score</Th>
                <Th>Wants</Th>
                <Th>Status</Th>
                <Th>Value</Th>
                <Th>Captured</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lead) => {
                const scoreBand = bandFor(lead.score);
                return (
                  <tr key={lead.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <div className="font-medium text-slate-200">{lead.name ?? "Unnamed caller"}</div>
                      <div className="text-[12px] text-slate-500">{lead.phone ?? lead.email ?? "No contact details"}</div>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${BAND_LABELS[scoreBand].tone}`}>
                        {BAND_LABELS[scoreBand].icon} {lead.score}
                      </span>
                    </Td>
                    <Td className="max-w-[220px]">
                      <div className="truncate text-[13px] text-slate-300">{lead.serviceRequested ?? "—"}</div>
                      {lead.summary && <div className="truncate text-[12px] text-slate-500">{lead.summary}</div>}
                    </Td>
                    <Td>
                      <Badge tone={toneFor(LEAD_STATUSES, lead.status)}>{labelFor(LEAD_STATUSES, lead.status)}</Badge>
                    </Td>
                    <Td className="text-[13px] text-slate-400">
                      {lead.estimatedValue ? `€${lead.estimatedValue.toLocaleString()}` : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-[13px] text-slate-400">{formatDate(lead.createdAt)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {lead.call && (
                          <Link href={`/app/calls/${lead.call.id}`}>
                            <Button variant="ghost" size="sm" aria-label="Open the call">
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setEditing(lead)}>Edit</Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pager page={data.page} pageCount={data.pageCount} onChange={setPage} />
        </Card>
      )}

      <LeadModal
        lead={editing}
        open={Boolean(editing) || creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={refresh}
      />
    </>
  );
}

function LeadModal({
  lead,
  open,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", company: "", serviceRequested: "",
    status: "new", estimatedValue: "", notes: "", score: 0,
  });
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState<string | null>(null);

  // Load the selected lead into the form once per lead, not on every render.
  const key = lead?.id ?? "new";
  if (open && initialised !== key) {
    setInitialised(key);
    setForm({
      name: lead?.name ?? "",
      phone: lead?.phone ?? "",
      email: lead?.email ?? "",
      company: lead?.company ?? "",
      serviceRequested: lead?.serviceRequested ?? "",
      status: lead?.status ?? "new",
      estimatedValue: lead?.estimatedValue ? String(lead.estimatedValue) : "",
      notes: lead?.notes ?? "",
      score: lead?.score ?? 0,
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        company: form.company,
        serviceRequested: form.serviceRequested,
        status: form.status,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
        notes: form.notes,
        ...(lead && { score: form.score }),
      };
      if (lead) await api(`/api/v1/leads/${lead.id}`, "PATCH", payload);
      else await api("/api/v1/leads", "POST", payload);

      toast.success("Saved");
      setInitialised(null);
      onSaved();
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
      onClose={() => { setInitialised(null); onClose(); }}
      wide
      title={lead ? "Edit lead" : "Add a lead"}
      description={lead ? "Update what you know and where it's got to." : "For a lead that came in some other way."}
      footer={
        <>
          <Button variant="secondary" onClick={() => { setInitialised(null); onClose(); }}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Service wanted"><Input value={form.serviceRequested} onChange={(e) => setForm({ ...form, serviceRequested: e.target.value })} /></Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated value" hint="Used for the pipeline estimate on your dashboard. It is an estimate, not revenue.">
          <Input
            type="number"
            min={0}
            value={form.estimatedValue}
            onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
            placeholder="450"
          />
        </Field>
        {lead && (
          <Field label={`Score — ${form.score}/100`} hint="Your AI scored this. Override it if you disagree.">
            <input
              type="range"
              min={0}
              max={100}
              value={form.score}
              onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
