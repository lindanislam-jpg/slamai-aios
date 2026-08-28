"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import {
  Mic, Phone, PhoneIncoming, PhoneOutgoing, Clock, TrendingUp, Calendar,
  Plus, X, Loader2, PhoneCall,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

interface CallLog {
  id: string; caller: string; direction: string; durationSec: number;
  outcome: string; summary: string | null; createdAt: string;
}

interface CallsResponse {
  calls: CallLog[];
  stats: { total: number; totalSeconds: number; booked: number; bookingRate: number };
}

const OUTCOMES = ["completed", "qualified", "booked", "transferred", "voicemail", "no-answer"];

const OUTCOME_COLORS: Record<string, string> = {
  completed:   "bg-teal-500/20 text-teal-400",
  qualified:   "bg-green-500/20 text-green-400",
  booked:      "bg-purple-500/20 text-purple-400",
  transferred: "bg-blue-500/20 text-blue-400",
  voicemail:   "bg-yellow-500/20 text-yellow-400",
  "no-answer": "bg-slate-500/20 text-slate-400",
};

export default function VoiceAIPage() {
  const { data, loading, error, refresh } = useResource<CallsResponse>("/api/voice/calls");
  const [showLog, setShowLog] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({
    caller: "", direction: "inbound", minutes: "0", seconds: "0", outcome: OUTCOMES[0], summary: "",
  });

  async function logCall() {
    if (!form.caller.trim()) return;
    setSaving(true);
    try {
      await mutate("/api/voice/calls", "POST", {
        caller:      form.caller.trim(),
        direction:   form.direction,
        durationSec: Number(form.minutes) * 60 + Number(form.seconds),
        outcome:     form.outcome,
        summary:     form.summary.trim() || undefined,
      });
      await refresh();
      setShowLog(false);
      setForm({ caller: "", direction: "inbound", minutes: "0", seconds: "0", outcome: OUTCOMES[0], summary: "" });
      toast.success("Call logged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the call");
    } finally {
      setSaving(false);
    }
  }

  const stats = data?.stats;
  const calls = data?.calls ?? [];
  const avgSeconds = stats && stats.total ? Math.round(stats.totalSeconds / stats.total) : 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Voice AI" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Provider notice — honest about what is and isn't connected */}
        <div className="glass rounded-2xl p-5 flex items-start gap-4 border border-yellow-500/20">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
            <PhoneCall className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="font-medium text-sm text-slate-200">No telephony provider connected</div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              Calls are recorded here through <code className="text-brand-400">POST /api/voice/calls</code>. Point a Twilio or
              Vonage webhook at that endpoint to have calls appear automatically, or log them by hand below in the meantime.
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading call history…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Calls",      value: stats?.total ?? 0,                    icon: Phone,      color: "text-blue-400",   bg: "bg-blue-500/10"   },
                { label: "Avg. Handle Time", value: formatDuration(avgSeconds),           icon: Clock,      color: "text-green-400",  bg: "bg-green-500/10"  },
                { label: "Appointments Set", value: stats?.booked ?? 0,                   icon: Calendar,   color: "text-purple-400", bg: "bg-purple-500/10" },
                { label: "Booking Rate",     value: `${stats?.bookingRate ?? 0}%`,        icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/10" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-xl p-4">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Call logs */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold">Call History</h3>
                <button onClick={() => setShowLog(true)} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Log a Call
                </button>
              </div>

              {calls.length === 0 ? (
                <EmptyState
                  icon={Mic}
                  title="No calls recorded yet"
                  description="Connect a telephony provider to this workspace, or log a call manually to start building history."
                  action={<button onClick={() => setShowLog(true)} className="btn-primary text-sm">Log your first call</button>}
                />
              ) : (
                <div className="space-y-2">
                  {calls.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 p-3 bg-slam-dark rounded-xl border border-slam-border hover:border-slate-600 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                        {c.direction === "outbound"
                          ? <PhoneOutgoing className="w-4 h-4 text-brand-400" />
                          : <PhoneIncoming className="w-4 h-4 text-brand-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{c.caller}</div>
                        <div className="text-xs text-slate-500 truncate">{c.summary || `${c.direction} call`}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDuration(c.durationSec)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${OUTCOME_COLORS[c.outcome] || "bg-slate-500/20 text-slate-400"}`}>
                          {c.outcome}
                        </span>
                        <span className="text-xs text-slate-600 hidden sm:inline">{formatRelativeTime(c.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Log call modal */}
      {showLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slam-border">
              <h2 className="font-bold">Log a Call</h2>
              <button onClick={() => setShowLog(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Caller</label>
                <input
                  value={form.caller}
                  onChange={(e) => setForm((p) => ({ ...p, caller: e.target.value }))}
                  placeholder="+353 1 234 5678"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Direction</label>
                  <select value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))} className="input-field">
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Outcome</label>
                  <select value={form.outcome} onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))} className="input-field capitalize">
                    {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Duration</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={form.minutes} onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))} className="input-field" />
                  <span className="text-sm text-slate-500">min</span>
                  <input type="number" min="0" max="59" value={form.seconds} onChange={(e) => setForm((p) => ({ ...p, seconds: e.target.value }))} className="input-field" />
                  <span className="text-sm text-slate-500">sec</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Summary (optional)</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="What was the call about?"
                  className="input-field min-h-[80px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLog(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={logCall} disabled={!form.caller.trim() || saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Log Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
