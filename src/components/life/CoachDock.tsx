"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildSnapshot, localAnswer } from "@/lib/life/coach";
import { useLife } from "@/lib/life/store";
import { Icon } from "./icons";
import { Btn } from "./ui";

const SUGGESTIONS = [
  "What should I do right now?",
  "Why am I losing momentum?",
  "How did I perform this week?",
  "What should I focus on tomorrow?",
  "Which habit is holding me back?",
  "Am I improving?",
];

/** Renders the small subset of markdown the coach actually emits. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className={cn("text-[13.5px] leading-relaxed", i > 0 && "mt-3")}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={j} className="font-semibold" style={{ color: "var(--accent)" }}>
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{chunk}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function CoachDock({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, pushCoach, clearCoach } = useLife();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [open, state.coach.length, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setNote(null);
    pushCoach({ role: "user", content: q });
    setBusy(true);

    const snapshot = buildSnapshot(state);
    try {
      const res = await fetch("/api/life/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, snapshot }),
      });
      if (!res.ok) throw new Error(`Coach responded ${res.status}`);
      const data = (await res.json()) as { answer: string; source: "local" | "model"; note?: string };
      pushCoach({ role: "coach", content: data.answer, source: data.source });
      if (data.note) setNote(data.note);
    } catch {
      // Offline or the route is unreachable: answer from the same engine, locally.
      pushCoach({ role: "coach", content: localAnswer(snapshot, q), source: "local" });
      setNote("Offline — answered from local analysis on this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        aria-label="AI Life Coach"
        className="fixed bottom-[84px] right-4 z-[60] grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
        style={{
          background: "linear-gradient(180deg, hsl(var(--a-h) var(--a-s) calc(var(--a-l) + 8%)), var(--accent))",
          color: "hsl(var(--a-h) 60% 8%)",
          boxShadow: "0 14px 40px -12px var(--accent-glow)",
        }}
      >
        <Icon name={open ? "X" : "Sparkles"} className="h-6 w-6" strokeWidth={1.9} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[59] lg:inset-auto lg:bottom-24 lg:right-6 lg:h-[min(680px,80vh)] lg:w-[420px]">
          <div className="scrim fade absolute inset-0 lg:hidden" onClick={() => onOpenChange(false)} />
          <div className="panel panel-lit rise relative flex h-full flex-col overflow-hidden rounded-none lg:rounded-[var(--r-lg)]">
            <header className="flex items-center gap-3 border-b border-[var(--hair)] px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--accent-soft)" }}>
                <Icon name="Sparkles" className="h-[18px] w-[18px]" style={{ color: "var(--accent)" }} />
              </span>
              <div className="flex-1">
                <div className="text-[14px] font-semibold tracking-tight">AI Life Coach</div>
                <div className="text-[11px] text-[var(--ink-3)]">Reads your real data. Answers straight.</div>
              </div>
              {state.coach.length ? (
                <button
                  onClick={clearCoach}
                  className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              ) : null}
              <button onClick={() => onOpenChange(false)} className="text-[var(--ink-3)] hover:text-[var(--ink)] lg:hidden">
                <Icon name="X" className="h-5 w-5" />
              </button>
            </header>

            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {state.coach.length === 0 ? (
                <div className="pt-2">
                  <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">
                    I can see your momentum, streaks, rhythm, priorities and North Star. Ask me anything about them —
                    or start here.
                  </p>
                  <div className="mt-4 space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--hair)] bg-[var(--panel)] px-3.5 py-2.5 text-left text-[13px] transition hover:border-[var(--hair-strong)]"
                      >
                        <Icon name="ArrowRight" className="h-3.5 w-3.5 shrink-0 text-[var(--ink-4)]" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                state.coach.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px]"
                        style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="fade">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="kicker">Coach</span>
                        <span
                          className="rounded-full border border-[var(--hair)] px-1.5 py-px text-[9px] uppercase tracking-wider text-[var(--ink-4)]"
                          title={
                            m.source === "model"
                              ? "Generated by the configured language model"
                              : "Computed on this device from your tracked data"
                          }
                        >
                          {m.source === "model" ? "AI model" : "Local analysis"}
                        </span>
                      </div>
                      <Rich text={m.content} />
                    </div>
                  ),
                )
              )}

              {busy ? (
                <div className="flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
                  <Icon name="Loader2" className="h-3.5 w-3.5 animate-spin" />
                  Reading your data…
                </div>
              ) : null}

              {note ? <p className="text-[11px] leading-relaxed text-[var(--ink-4)]">{note}</p> : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="flex items-center gap-2 border-t border-[var(--hair)] p-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the coach…"
                aria-label="Ask the coach"
                className="field"
              />
              <Btn type="submit" variant="accent" disabled={busy || !input.trim()} className="shrink-0 px-4">
                <Icon name="ArrowRight" className="h-4 w-4" />
              </Btn>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
