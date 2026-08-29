"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/dashboard/Header";
import {
  Mic, Phone, PhoneIncoming, PhoneOutgoing, Clock, TrendingUp, Calendar, Users,
  Plus, X, Loader2, PowerOff, Power, Save, ChevronDown, ChevronRight, Copy, Check, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatDuration, formatRelativeTime } from "@/lib/utils";

interface Turn { role: "assistant" | "user"; text: string }

interface CallLog {
  id: string; caller: string; direction: string; durationSec: number;
  outcome: string; summary: string | null; createdAt: string;
  callSid: string | null; transcript: Turn[];
  contact: { id: string; name: string; email: string | null; stage: string } | null;
}

interface CallsResponse {
  calls: CallLog[];
  stats: { total: number; totalSeconds: number; booked: number; leads: number; bookingRate: number };
}

interface VoiceAgent {
  id: string; phoneNumber: string | null; isActive: boolean; greeting: string;
  systemPrompt: string; voice: string; transferNumber: string | null;
  captureLeads: boolean; maxTurns: number;
  voices: { id: string; label: string }[];
  twilioConfigured: boolean;
  webhookBase: string;
}

const OUTCOMES = ["completed", "qualified", "booked", "transferred", "voicemail", "no-answer"];

const OUTCOME_COLORS: Record<string, string> = {
  completed:     "bg-teal-500/20 text-teal-400",
  qualified:     "bg-green-500/20 text-green-400",
  booked:        "bg-purple-500/20 text-purple-400",
  transferred:   "bg-blue-500/20 text-blue-400",
  voicemail:     "bg-yellow-500/20 text-yellow-400",
  "no-answer":   "bg-slate-500/20 text-slate-400",
  "in-progress": "bg-brand-500/20 text-brand-300",
  failed:        "bg-red-500/20 text-red-400",
};

export default function VoiceAIPage() {
  const calls = useResource<CallsResponse>("/api/voice/calls");
  const agentRes = useResource<VoiceAgent>("/api/voice/agent");

  const [form, setForm] = useState({
    phoneNumber: "", greeting: "", systemPrompt: "", voice: "Polly.Amy",
    transferNumber: "", captureLeads: true,
  });
  const [savingAgent, setSavingAgent] = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const [showLog, setShowLog] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [callForm, setCallForm] = useState({
    caller: "", direction: "inbound", minutes: "0", seconds: "0", outcome: OUTCOMES[0], summary: "",
  });

  const agent = agentRes.data;

  useEffect(() => {
    if (agent) {
      setForm({
        phoneNumber:    agent.phoneNumber || "",
        greeting:       agent.greeting,
        systemPrompt:   agent.systemPrompt,
        voice:          agent.voice,
        transferNumber: agent.transferNumber || "",
        captureLeads:   agent.captureLeads,
      });
    }
  }, [agent]);

  async function saveAgent() {
    setSavingAgent(true);
    try {
      await mutate("/api/voice/agent", "PATCH", form);
      await agentRes.refresh();
      toast.success("Agent settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the agent");
    } finally {
      setSavingAgent(false);
    }
  }

  async function toggleActive() {
    if (!agent) return;
    setToggling(true);
    try {
      await mutate("/api/voice/agent", "PATCH", {
        ...form,
        isActive: !agent.isActive,
      });
      await agentRes.refresh();
      toast.success(agent.isActive ? "Agent deactivated" : "Agent is live — calls will be answered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the agent state");
    } finally {
      setToggling(false);
    }
  }

  async function logCall() {
    if (!callForm.caller.trim()) return;
    setSavingCall(true);
    try {
      await mutate("/api/voice/calls", "POST", {
        caller:      callForm.caller.trim(),
        direction:   callForm.direction,
        durationSec: Number(callForm.minutes) * 60 + Number(callForm.seconds),
        outcome:     callForm.outcome,
        summary:     callForm.summary.trim() || undefined,
      });
      await calls.refresh();
      setShowLog(false);
      setCallForm({ caller: "", direction: "inbound", minutes: "0", seconds: "0", outcome: OUTCOMES[0], summary: "" });
      toast.success("Call logged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the call");
    } finally {
      setSavingCall(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 2000);
  }

  const stats = calls.data?.stats;
  const list  = calls.data?.calls ?? [];
  const avgSeconds = stats && stats.total ? Math.round(stats.totalSeconds / stats.total) : 0;
  const base = agent?.webhookBase?.replace(/\/$/, "") || "https://your-domain.ie";

  return (
    <div className="flex flex-col h-full">
      <Header title="Voice AI" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Live status */}
        {agentRes.loading ? (
          <LoadingState label="Loading your voice agent…" />
        ) : agentRes.error ? (
          <ErrorState message={agentRes.error} onRetry={agentRes.refresh} />
        ) : !agent ? null : (
          <>
            <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative flex-shrink-0">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${
                  agent.isActive ? "border-green-500 shadow-lg shadow-green-500/30" : "border-slam-border"
                }`}>
                  {agent.isActive && <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />}
                  <Mic className={`w-10 h-10 ${agent.isActive ? "text-green-400" : "text-slate-600"}`} />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className={`text-lg font-bold ${agent.isActive ? "text-green-400" : "text-slate-500"}`}>
                  {agent.isActive ? "Agent live — answering calls" : "Agent offline"}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {agent.phoneNumber
                    ? <>Answering <span className="text-slate-300 font-medium">{agent.phoneNumber}</span></>
                    : "Add your Twilio number below to go live."}
                </p>
                {!agent.twilioConfigured && (
                  <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1.5 justify-center sm:justify-start">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    TWILIO_AUTH_TOKEN isn&apos;t set — incoming calls will be rejected.
                  </p>
                )}
              </div>

              <button
                onClick={toggleActive}
                disabled={toggling || !agent.phoneNumber}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-40 flex-shrink-0 ${
                  agent.isActive
                    ? "bg-red-600/20 text-red-400 border border-red-600/40 hover:bg-red-600/30"
                    : "bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30"
                }`}
              >
                {toggling ? <Loader2 className="w-5 h-5 animate-spin" />
                  : agent.isActive ? <><PowerOff className="w-5 h-5" />Deactivate</>
                  : <><Power className="w-5 h-5" />Activate</>}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Total Calls",      value: stats?.total ?? 0,             icon: Phone,      color: "text-blue-400",   bg: "bg-blue-500/10"   },
                { label: "Avg. Handle Time", value: formatDuration(avgSeconds),    icon: Clock,      color: "text-green-400",  bg: "bg-green-500/10"  },
                { label: "Qualified/Booked", value: stats?.booked ?? 0,            icon: Calendar,   color: "text-purple-400", bg: "bg-purple-500/10" },
                { label: "Leads Captured",   value: stats?.leads ?? 0,             icon: Users,      color: "text-cyan-400",   bg: "bg-cyan-500/10"   },
                { label: "Conversion",       value: `${stats?.bookingRate ?? 0}%`, icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/10" },
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agent settings */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold">Agent Settings</h3>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Your Twilio number</label>
                  <input
                    value={form.phoneNumber}
                    onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                    placeholder="+35315551234"
                    className="input-field"
                  />
                  <p className="text-xs text-slate-600 mt-1.5">International format, starting with +.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Greeting</label>
                  <textarea
                    value={form.greeting}
                    onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))}
                    className="input-field min-h-[70px] resize-none"
                  />
                  <p className="text-xs text-slate-600 mt-1.5">The first thing every caller hears.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Instructions</label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                    className="input-field min-h-[110px] resize-none"
                  />
                  <p className="text-xs text-slate-600 mt-1.5">
                    How the agent should behave. Be specific about what it may and may not promise.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">Voice</label>
                    <select
                      value={form.voice}
                      onChange={(e) => setForm((p) => ({ ...p, voice: e.target.value }))}
                      className="input-field"
                    >
                      {agent.voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">Transfer to</label>
                    <input
                      value={form.transferNumber}
                      onChange={(e) => setForm((p) => ({ ...p, transferNumber: e.target.value }))}
                      placeholder="+353871234567"
                      className="input-field"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <div>
                    <span className="text-sm text-slate-300">Capture callers as CRM leads</span>
                    <p className="text-xs text-slate-600">Creates a contact from what the caller tells the agent.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, captureLeads: !p.captureLeads }))}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.captureLeads ? "bg-brand-600" : "bg-slam-border"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.captureLeads ? "left-5" : "left-0.5"}`} />
                  </button>
                </label>

                <button
                  onClick={saveAgent}
                  disabled={savingAgent}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save settings
                </button>
              </div>

              {/* Twilio setup */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold mb-2">Connect Twilio</h3>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  In the Twilio console, open your number and paste these two URLs. Then put your Account SID
                  and Auth Token into the app&apos;s environment variables.
                </p>

                <div className="space-y-4">
                  {[
                    { label: "A call comes in — Webhook (HTTP POST)", url: `${base}/api/voice/twilio/incoming`, key: "incoming" },
                    { label: "Call status changes — Webhook (HTTP POST)", url: `${base}/api/voice/twilio/status`, key: "status" },
                  ].map((row) => (
                    <div key={row.key}>
                      <div className="text-xs font-medium text-slate-400 mb-1.5">{row.label}</div>
                      <div className="flex items-center gap-2 bg-slam-dark border border-slam-border rounded-lg p-2.5">
                        <code className="text-xs text-brand-300 flex-1 truncate">{row.url}</code>
                        <button
                          onClick={() => copy(row.url, row.key)}
                          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                          title="Copy"
                        >
                          {copied === row.key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slam-border">
                    <div className="text-xs font-medium text-slate-400 mb-2">Environment variables</div>
                    <div className="space-y-1.5 text-xs">
                      {[
                        ["TWILIO_ACCOUNT_SID", "From the Twilio console dashboard"],
                        ["TWILIO_AUTH_TOKEN", "Signs and verifies every webhook"],
                        ["OPENAI_API_KEY", "Powers what the agent says"],
                      ].map(([name, note]) => (
                        <div key={name} className="flex items-start justify-between gap-3">
                          <code className="text-brand-300 flex-shrink-0">{name}</code>
                          <span className="text-slate-600 text-right">{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed pt-2">
                    Every webhook is signature-verified, so a request that isn&apos;t genuinely from Twilio is rejected.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Call history */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Call History</h3>
            <button onClick={() => setShowLog(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Log a Call
            </button>
          </div>

          {calls.loading ? (
            <LoadingState label="Loading call history…" />
          ) : calls.error ? (
            <ErrorState message={calls.error} onRetry={calls.refresh} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Mic}
              title="No calls yet"
              description="Once your Twilio number is connected and the agent is live, calls appear here with a full transcript."
            />
          ) : (
            <div className="space-y-2">
              {list.map((c) => {
                const isOpen = expanded === c.id;
                return (
                  <div key={c.id} className="bg-slam-dark rounded-xl border border-slam-border overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="w-full flex items-center gap-4 p-3 hover:border-slate-600 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                        {c.direction === "outbound"
                          ? <PhoneOutgoing className="w-4 h-4 text-brand-400" />
                          : <PhoneIncoming className="w-4 h-4 text-brand-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{c.caller}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {c.summary || (c.transcript.length ? `${c.transcript.length} turns` : `${c.direction} call`)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {c.contact && (
                          <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full hidden sm:inline">
                            lead
                          </span>
                        )}
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDuration(c.durationSec)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${OUTCOME_COLORS[c.outcome] || OUTCOME_COLORS.completed}`}>
                          {c.outcome}
                        </span>
                        <span className="text-xs text-slate-600 hidden md:inline">{formatRelativeTime(c.createdAt)}</span>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-slam-border space-y-4">
                        {c.contact && (
                          <div className="flex items-center gap-2 text-sm pt-3">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-slate-400">Captured as</span>
                            <Link href="/crm" className="text-cyan-400 hover:text-cyan-300 font-medium">
                              {c.contact.name}
                            </Link>
                            <span className="text-xs text-slate-600">({c.contact.stage})</span>
                          </div>
                        )}

                        {c.transcript.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            {c.transcript.map((t, i) => (
                              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                                  t.role === "user"
                                    ? "bg-brand-600/80 text-white rounded-br-sm"
                                    : "bg-slam-card border border-slam-border text-slate-300 rounded-bl-sm"
                                }`}>
                                  {t.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 pt-3">No transcript for this call.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                  value={callForm.caller}
                  onChange={(e) => setCallForm((p) => ({ ...p, caller: e.target.value }))}
                  placeholder="+353 1 234 5678"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Direction</label>
                  <select value={callForm.direction} onChange={(e) => setCallForm((p) => ({ ...p, direction: e.target.value }))} className="input-field">
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Outcome</label>
                  <select value={callForm.outcome} onChange={(e) => setCallForm((p) => ({ ...p, outcome: e.target.value }))} className="input-field capitalize">
                    {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Duration</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={callForm.minutes} onChange={(e) => setCallForm((p) => ({ ...p, minutes: e.target.value }))} className="input-field" />
                  <span className="text-sm text-slate-500">min</span>
                  <input type="number" min="0" max="59" value={callForm.seconds} onChange={(e) => setCallForm((p) => ({ ...p, seconds: e.target.value }))} className="input-field" />
                  <span className="text-sm text-slate-500">sec</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Summary (optional)</label>
                <textarea
                  value={callForm.summary}
                  onChange={(e) => setCallForm((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="What was the call about?"
                  className="input-field min-h-[80px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLog(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={logCall} disabled={!callForm.caller.trim() || savingCall} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  {savingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
