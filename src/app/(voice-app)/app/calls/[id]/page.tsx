"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Bot, Calendar, Copy, Download, Search, User,
} from "lucide-react";
import { useApi } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, ErrorState, Input, Loading,
} from "@/components/voice/ui";
import { formatDuration } from "@/lib/utils";
import { formatInZone } from "@/lib/voice/hours";
import { bandFor, BAND_LABELS } from "@/lib/voice/scoring";
import { OUTCOME_TONE } from "@/lib/voice/labels";

type CallDetail = {
  call: {
    id: string; fromNumber: string; toNumber: string; startedAt: string; endedAt: string | null;
    durationSec: number; status: string; outcome: string; summary: string | null;
    intent: string | null; sentiment: string | null; isEmergency: boolean; afterHours: boolean;
    transferred: boolean; recordingUrl: string | null; aiHandled: boolean;
    agent: { id: string; name: string; voice: string } | null;
    customer: { id: string; name: string | null; phone: string | null; email: string | null; addressLine: string | null } | null;
    lead: { id: string; score: number; status: string; serviceRequested: string | null; urgency: string } | null;
    turns: { id: string; role: string; text: string; offsetSec: number }[];
    appointments: { id: string; title: string; startsAt: string; status: string; service: { name: string } | null }[];
  };
  timezone: string;
};

export default function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, refresh } = useApi<CallDetail>(`/api/v1/calls/${id}`);
  const [search, setSearch] = useState("");

  const turns = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return needle
      ? data.call.turns.filter((t) => t.text.toLowerCase().includes(needle))
      : data.call.turns;
  }, [data, search]);

  if (loading) return <Loading label="Loading this call…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const { call, timezone } = data;
  const band = call.lead ? bandFor(call.lead.score) : null;

  const transcriptText = call.turns
    .map((t) => `[${formatOffset(t.offsetSec)}] ${t.role === "caller" ? "CUSTOMER" : t.role === "agent" ? "AI" : "SYSTEM"}: ${t.text}`)
    .join("\n");

  return (
    <>
      <Link href="/app/calls" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> All calls
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {call.customer?.name ?? call.fromNumber}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-slate-400">
            <span>{formatInZone(call.startedAt, timezone, { dateStyle: "full", timeStyle: "short" })}</span>
            <span className="text-slate-600">·</span>
            <span>{formatDuration(call.durationSec)}</span>
            <Badge tone={OUTCOME_TONE[call.outcome] ?? "neutral"}>{call.outcome.replace(/_/g, " ")}</Badge>
            {call.isEmergency && <Badge tone="danger">Urgent</Badge>}
            {call.afterHours && <Badge tone="neutral">After hours</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(transcriptText);
                toast.success("Transcript copied");
              } catch {
                toast.error("Your browser blocked the clipboard.");
              }
            }}
          >
            Copy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => {
              const blob = new Blob([transcriptText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `call-${call.id}.txt`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {call.summary && (
            <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] to-transparent p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-300">
                <Bot className="h-3.5 w-3.5" /> AI summary
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-200">{call.summary}</p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Transcript"
              description={`${call.turns.length} turns`}
              action={
                <div className="relative w-48">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="py-1.5 pl-8 text-[13px]"
                  />
                </div>
              }
            />
            <div className="space-y-4 p-5">
              {turns.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-500">
                  {search ? "Nothing in the transcript matches that." : "No transcript was recorded for this call."}
                </p>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`flex gap-3 ${turn.role === "agent" ? "flex-row-reverse text-right" : ""}`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        turn.role === "agent"
                          ? "bg-gradient-to-br from-indigo-500 to-violet-600"
                          : turn.role === "system"
                            ? "bg-slate-700"
                            : "bg-white/10"
                      }`}
                    >
                      {turn.role === "agent" ? (
                        <Bot className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-slate-300" />
                      )}
                    </div>
                    <div className={`max-w-[80%] ${turn.role === "agent" ? "items-end" : ""}`}>
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500" style={{ justifyContent: turn.role === "agent" ? "flex-end" : "flex-start" }}>
                        <span className="font-medium uppercase tracking-wider">
                          {turn.role === "caller" ? "Customer" : turn.role === "agent" ? "AI" : "System"}
                        </span>
                        <span>{formatOffset(turn.offsetSec)}</span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                          turn.role === "agent"
                            ? "bg-indigo-500/15 text-slate-100"
                            : turn.role === "system"
                              ? "border border-white/[0.06] bg-white/[0.02] text-[13px] italic text-slate-500"
                              : "bg-white/[0.05] text-slate-200"
                        }`}
                      >
                        {turn.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Caller" />
            <dl className="space-y-2.5 p-5 text-[13px]">
              <Row label="Number" value={call.fromNumber} />
              <Row label="Name" value={call.customer?.name ?? "Not given"} />
              <Row label="Email" value={call.customer?.email ?? "Not given"} />
              <Row label="Address" value={call.customer?.addressLine ?? "Not given"} />
              <Row label="Dialled" value={call.toNumber} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="What the AI made of it" />
            <dl className="space-y-2.5 p-5 text-[13px]">
              <Row label="Intent" value={call.intent ?? "Unknown"} />
              <Row
                label="Sentiment"
                value={
                  <Badge tone={call.sentiment === "positive" ? "success" : call.sentiment === "negative" ? "danger" : "neutral"}>
                    {call.sentiment ?? "neutral"}
                  </Badge>
                }
              />
              <Row label="Handled by" value={call.aiHandled ? "AI" : "A person"} />
              <Row label="Recording" value={call.recordingUrl ? "Available" : "Not recorded"} />
            </dl>
          </Card>

          {call.lead && band && (
            <Card>
              <CardHeader title="Lead" action={<Link href="/app/leads" className="text-[13px] text-indigo-300">Open →</Link>} />
              <div className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-semibold leading-none text-white">{call.lead.score}</span>
                  <span className="text-[13px] text-slate-500">/ 100</span>
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${BAND_LABELS[band].tone}`}>
                    {BAND_LABELS[band].icon} {BAND_LABELS[band].label}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${band === "hot" ? "bg-orange-500" : band === "warm" ? "bg-amber-500" : "bg-sky-500"}`}
                    style={{ width: `${call.lead.score}%` }}
                  />
                </div>
                <dl className="mt-4 space-y-2.5 text-[13px]">
                  <Row label="Wants" value={call.lead.serviceRequested ?? "Not specified"} />
                  <Row label="Urgency" value={call.lead.urgency} />
                  <Row label="Status" value={call.lead.status} />
                </dl>
              </div>
            </Card>
          )}

          {call.appointments.length > 0 && (
            <Card>
              <CardHeader title="Booked on this call" />
              <div className="space-y-2 p-5">
                {call.appointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-emerald-200">
                      <Calendar className="h-3.5 w-3.5" />
                      {appointment.service?.name ?? appointment.title}
                    </div>
                    <div className="mt-1 text-[12.5px] text-slate-400">
                      {formatInZone(appointment.startsAt, timezone, { dateStyle: "full", timeStyle: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-right capitalize text-slate-200">{value}</dd>
    </div>
  );
}

function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
