"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Search } from "lucide-react";
import { useApi } from "@/lib/voice/client";
import {
  Badge, Card, EmptyState, ErrorState, Input, Loading, PageHeader, Pager,
  Select, Table, Td, Th,
} from "@/components/voice/ui";
import { formatDuration } from "@/lib/utils";
import { formatInZone } from "@/lib/voice/hours";
import { bandFor, BAND_LABELS } from "@/lib/voice/scoring";
import { OUTCOME_TONE } from "@/lib/voice/labels";

type CallRow = {
  id: string; fromNumber: string; startedAt: string; durationSec: number;
  status: string; outcome: string; summary: string | null; sentiment: string | null;
  transferred: boolean; isEmergency: boolean; afterHours: boolean;
  agent: { id: string; name: string } | null;
  customer: { id: string; name: string | null } | null;
  lead: { id: string; score: number; status: string } | null;
};

const OUTCOMES = [
  { value: "all", label: "All outcomes" },
  { value: "booked", label: "Appointment booked" },
  { value: "lead_captured", label: "Lead captured" },
  { value: "transferred", label: "Transferred" },
  { value: "message_taken", label: "Message taken" },
  { value: "info_only", label: "Question answered" },
  { value: "missed", label: "Missed" },
];

export default function CallsPage() {
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const url = `/api/v1/calls?page=${page}&outcome=${outcome}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const { data, loading, error, refresh } = useApi<{
    items: CallRow[]; total: number; page: number; pageCount: number;
  }>(url);

  // Timezone comes from the dashboard endpoint; calls render in it too.
  const { data: meta } = useApi<{ timezone: string }>("/api/v1/dashboard");
  const timezone = meta?.timezone ?? "Europe/Dublin";

  return (
    <>
      <PageHeader
        title="Calls"
        description="Every call your AI has answered, with the full transcript and what it decided to do."
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
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by number, name or what was said"
              className="pl-9"
            />
          </div>
          <Select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setPage(1);
            }}
            className="w-auto min-w-[190px]"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </form>
      </Card>

      {loading ? (
        <Loading label="Loading calls…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-6 w-6" />}
          title={query || outcome !== "all" ? "No calls match that" : "No calls yet"}
          description={
            query || outcome !== "all"
              ? "Try a different search or clear the filter."
              : "Once your number is connected and your receptionist is on, every call lands here with its transcript, summary and lead score."
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Caller</Th>
                <Th>When</Th>
                <Th>Length</Th>
                <Th>Outcome</Th>
                <Th>Lead</Th>
                <Th>Summary</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((call) => {
                const band = call.lead ? bandFor(call.lead.score) : null;
                return (
                  <tr key={call.id} className="cursor-pointer transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/app/calls/${call.id}`} className="block">
                        <div className="font-medium text-slate-200">{call.customer?.name ?? call.fromNumber}</div>
                        {call.customer?.name && <div className="text-[12px] text-slate-500">{call.fromNumber}</div>}
                        <div className="mt-1 flex gap-1.5">
                          {call.isEmergency && <Badge tone="danger">Urgent</Badge>}
                          {call.afterHours && <Badge tone="neutral">After hours</Badge>}
                        </div>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-[13px] text-slate-400">
                      <Link href={`/app/calls/${call.id}`} className="block">
                        {formatInZone(call.startedAt, timezone, { dateStyle: "medium", timeStyle: "short" })}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-[13px] text-slate-400">
                      <Link href={`/app/calls/${call.id}`} className="block">{formatDuration(call.durationSec)}</Link>
                    </Td>
                    <Td>
                      <Link href={`/app/calls/${call.id}`} className="block">
                        <Badge tone={OUTCOME_TONE[call.outcome] ?? "neutral"}>
                          {OUTCOMES.find((o) => o.value === call.outcome)?.label ?? call.outcome.replace(/_/g, " ")}
                        </Badge>
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/app/calls/${call.id}`} className="block">
                        {band ? (
                          <span className="text-[13px] text-slate-300">
                            {BAND_LABELS[band].icon} {call.lead?.score}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-600">—</span>
                        )}
                      </Link>
                    </Td>
                    <Td className="max-w-[340px]">
                      <Link href={`/app/calls/${call.id}`} className="block">
                        <span className="line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                          {call.summary ?? "—"}
                        </span>
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pager page={data.page} pageCount={data.pageCount} onChange={setPage} />
        </Card>
      )}
    </>
  );
}
