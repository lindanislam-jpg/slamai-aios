"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Bot, BookOpen, Moon, PhoneOff, RotateCcw, Send, Sparkles, User, Wrench,
} from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, Input, Loading, PageHeader, Select, Toggle,
} from "@/components/voice/ui";

type Agent = { id: string; name: string; greeting: string; isActive: boolean };

type Turn = { role: "caller" | "agent"; text: string };

type TurnResponse = {
  reply: string;
  action: { type: string; reason?: string; number?: string | null };
  toolsUsed: { name: string; arguments: Record<string, unknown>; result: string }[];
  knowledgeUsed: { id: string; title: string; score: number }[];
  captured: Record<string, unknown>;
  tokens: number;
  greeting: string;
};

const SUGGESTIONS = [
  "Hi, my boiler has stopped working.",
  "How much do you charge for a call-out?",
  "Can I book someone for Thursday morning?",
  "I need to speak to a real person.",
  "There's water coming through my kitchen ceiling.",
  "Are you open on Saturdays?",
];

export default function TestPage() {
  const { data, loading } = useApi<{ agents: Agent[] }>("/api/v1/agents");
  const agents = data?.agents ?? [];

  const [agentId, setAgentId] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [afterHours, setAfterHours] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<TurnResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === agentId) ?? agents[0];

  useEffect(() => {
    if (!agentId && agents.length > 0) setAgentId(agents[0].id);
  }, [agents, agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, sending]);

  function reset() {
    setTurns([]);
    setEnded(null);
    setLastResponse(null);
    setInput("");
  }

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending || ended) return;

    const history = [...turns];
    setTurns([...history, { role: "caller", text: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const result = await api<TurnResponse>("/api/v1/test-call", "POST", {
        agentId: agent?.id,
        message: trimmed,
        history,
        simulateAfterHours: afterHours,
      });

      setTurns((t) => [...t, { role: "agent", text: result.reply }]);
      setLastResponse(result);

      if (result.action.type === "transfer") {
        setEnded(`Transferred to ${result.action.number ?? "a colleague"} — ${result.action.reason ?? ""}`);
      } else if (result.action.type === "hangup") {
        setEnded("Call ended.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
      // Drop the caller turn we optimistically added — the AI never heard it.
      setTurns(history);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading label="Getting your receptionist ready…" />;

  if (agents.length === 0) {
    return (
      <>
        <PageHeader title="Test your AI" />
        <Card className="px-6 py-14 text-center">
          <Bot className="mx-auto h-10 w-10 text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-white">You don&apos;t have a receptionist yet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
            Create one first, then come back here to hear how it handles a call.
          </p>
          <Link href="/app/agents">
            <Button className="mt-5">Create AI receptionist</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Test your AI"
        description="This is the same AI that answers your real calls, with the same knowledge and the same rules. Nothing here is saved to your calendar or your leads."
        action={
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
            Start over
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex h-[640px] flex-col lg:col-span-2">
          <CardHeader
            title={agent?.name ?? "AI Receptionist"}
            description="Type what a customer might say."
            action={
              agents.length > 1 ? (
                <Select value={agentId} onChange={(e) => { setAgentId(e.target.value); reset(); }} className="w-auto text-[13px]">
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              ) : null
            }
          />

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <Bubble role="agent" text={agent?.greeting ?? "Hello, how can I help?"} />

            {turns.map((turn, i) => (
              <Bubble key={i} role={turn.role} text={turn.text} />
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <span className="flex gap-1">
                  <Dot delay="0ms" /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
                thinking
              </div>
            )}

            {ended && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13px] text-slate-400">
                <PhoneOff className="h-3.5 w-3.5" />
                {ended}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {turns.length === 0 && (
            <div className="border-t border-white/[0.06] px-5 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Try one of these</div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="flex gap-2 border-t border-white/[0.06] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ended ? "This call has ended — start over to try again" : "Say something a customer would say…"}
              disabled={sending || Boolean(ended)}
            />
            <Button type="submit" loading={sending} disabled={Boolean(ended)} icon={<Send className="h-4 w-4" />}>
              Send
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <Toggle
              label="Pretend it's after hours"
              description="See how it behaves when you're closed."
              checked={afterHours}
              onChange={(v) => { setAfterHours(v); reset(); }}
            />
            {afterHours && (
              <div className="mt-2 flex items-center gap-2 text-[12.5px] text-indigo-300">
                <Moon className="h-3.5 w-3.5" /> Running as if you&apos;re closed.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="What it just did" description="Every action the AI took on that turn." />
            <div className="space-y-3 p-5">
              {!lastResponse ? (
                <p className="text-[13px] text-slate-500">Say something and this fills in.</p>
              ) : (
                <>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <Wrench className="h-3 w-3" /> Tools used
                    </div>
                    {lastResponse.toolsUsed.length === 0 ? (
                      <p className="text-[13px] text-slate-500">None — it just answered.</p>
                    ) : (
                      <div className="space-y-2">
                        {lastResponse.toolsUsed.map((tool, i) => (
                          <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                            <Badge tone="brand">{tool.name.replace(/_/g, " ")}</Badge>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{tool.result}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <BookOpen className="h-3 w-3" /> Knowledge used
                    </div>
                    {lastResponse.knowledgeUsed.length === 0 ? (
                      <p className="text-[13px] text-slate-500">
                        Nothing matched.{" "}
                        <Link href="/app/knowledge" className="text-indigo-300 hover:underline">Add knowledge</Link>
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {lastResponse.knowledgeUsed.map((k) => (
                          <li key={k.id} className="flex items-center justify-between gap-2 text-[12.5px] text-slate-400">
                            <span className="truncate">{k.title}</span>
                            <span className="shrink-0 text-slate-600">{Math.round(k.score * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {Object.keys(lastResponse.captured).length > 0 && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <Sparkles className="h-3 w-3" /> Details captured
                      </div>
                      <dl className="space-y-1 text-[12.5px]">
                        {Object.entries(lastResponse.captured).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-2">
                            <dt className="capitalize text-slate-500">{key}</dt>
                            <dd className="truncate text-slate-300">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[13px] font-semibold text-slate-200">Things worth testing</h3>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-slate-400">
              <li>• Ask a price you haven&apos;t told it — it should offer a callback, not guess.</li>
              <li>• Describe an emergency and see whether it collects an address.</li>
              <li>• Ask for a human and check it offers to transfer.</li>
              <li>• Ask something only your website answers.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Bubble({ role, text }: { role: "caller" | "agent"; text: string }) {
  const isAgent = role === "agent";
  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isAgent ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-white/10"
        }`}
      >
        {isAgent ? <Bot className="h-3.5 w-3.5 text-white" /> : <User className="h-3.5 w-3.5 text-slate-300" />}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
          isAgent ? "bg-indigo-500/15 text-slate-100" : "bg-white/[0.06] text-slate-200"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: delay }} />;
}
