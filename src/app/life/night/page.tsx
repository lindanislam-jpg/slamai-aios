"use client";

import { useMemo } from "react";
import { addDays, clockToMinutes, formatCountdown, formatDelta, clockDelta, minutesNow, shortDate } from "@/lib/life/date";
import { NIGHT_STEPS } from "@/lib/life/habits";
import {
  bedConsistency,
  dailyScore,
  getDay,
  habitsDone,
  momentum,
  dayXp,
} from "@/lib/life/engine";
import { debriefHeadline, yesterdayComparison } from "@/lib/life/coach";
import { useLife, useMounted, useNow } from "@/lib/life/store";
import { useAlarm } from "@/components/life/AlarmLayer";
import { Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, Kicker, Panel, SectionHeader } from "@/components/life/ui";
import type { Debrief } from "@/lib/life/types";

const EMPTY: Debrief = { wentWell: "", didnt: "", learned: "", change: "" };

const QUESTIONS = [
  { key: "wentWell" as const, label: "What went well?", icon: "Check" },
  { key: "didnt" as const, label: "What didn't?", icon: "Minus" },
  { key: "learned" as const, label: "What did I learn?", icon: "Sparkles" },
  { key: "change" as const, label: "What will I change tomorrow?", icon: "RotateCcw" },
];

export default function NightPage() {
  const { state, today, patchDay, setPriority, setHabit, goToBed, notify } = useLife();
  const { ring } = useAlarm();
  const now = useNow(1000);
  const mounted = useMounted();

  const day = getDay(state, today);
  const debrief = day.debrief ?? EMPTY;
  const tomorrow = addDays(today, 1);
  const tomorrowDay = getDay(state, tomorrow);
  const bedTarget = day.bedTarget ?? state.settings.bedTime;

  const secondsToBed = useMemo(() => {
    const diff = clockToMinutes(bedTarget) - minutesNow(now);
    return Math.round((diff < -720 ? diff + 1440 : diff) * 60);
  }, [bedTarget, now]);

  const m = momentum(state, today, now);
  const score = dailyScore(day);
  const bed = bedConsistency(state, 7);
  const tomorrowSet = tomorrowDay.priorities.filter((p) => p.title.trim()).length;

  const write = (patch: Partial<Debrief>) => {
    patchDay(today, (d) => ({ ...d, debrief: { ...EMPTY, ...d.debrief, ...patch } }));
  };

  const closeDay = () => {
    patchDay(today, (d) => ({ ...d, debrief: { ...EMPTY, ...d.debrief, completedAt: new Date().toISOString() } }));
    if (tomorrowSet >= 2) setHabit("win-tomorrow", true);
    notify({
      title: "Day closed",
      body: tomorrowSet >= 2 ? "Tomorrow is ready." : "Set tomorrow's two to close the habit.",
      tone: "success",
      xp: 20,
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Win tomorrow tonight"
        title={mounted && secondsToBed > 0 ? "Close the day properly." : "Time to reset."}
        sub="The quality of tomorrow morning is decided in the next thirty minutes."
        action={
          <div className="flex gap-2">
            <Btn size="sm" variant="ghost" icon="AlarmClock" onClick={() => ring("bed", { test: true })}>
              Preview bedtime mode
            </Btn>
            {day.bedActual ? (
              <Chip tone="accent">
                <Icon name="Check" className="h-3 w-3" /> Logged {day.bedActual}
              </Chip>
            ) : (
              <Btn
                size="sm"
                variant="accent"
                icon="MoonStar"
                onClick={() => {
                  goToBed();
                  notify({
                    title: "Lights out",
                    body: `${formatDelta(clockDelta(bedTarget, now.toTimeString().slice(0, 5)))} against ${bedTarget}.`,
                    tone: "success",
                    xp: 25,
                  });
                }}
              >
                I&apos;m going to bed
              </Btn>
            )}
          </div>
        }
      />

      {/* Day complete summary */}
      <Panel className="rise relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "var(--accent-glow)", opacity: 0.45 }}
        />
        <div className="relative flex flex-wrap items-center gap-8">
          <Ring value={score} size={150} thickness={10} gap={62}>
            <div>
              <div className="num text-[34px] leading-none">
                {habitsDone(day)}
                <span className="text-[18px] text-[var(--ink-4)]">/8</span>
              </div>
              <div className="kicker mt-1.5">Habits</div>
            </div>
          </Ring>

          <div className="min-w-0 flex-1">
            <Kicker>Day complete</Kicker>
            <h2 className="display mt-2 text-[clamp(1.4rem,3.2vw,2rem)] leading-tight">{debriefHeadline(state, now)}</h2>
            <p className="mt-2 text-[13px] text-[var(--ink-3)]">{yesterdayComparison(state, now)}</p>

            <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {[
                { k: "Daily score", v: `${score}%` },
                { k: "Momentum", v: `${m.score}`, sub: `${m.delta >= 0 ? "+" : ""}${m.delta}` },
                {
                  k: "Wake-up",
                  v: day.wakeActual ?? "—",
                  sub: day.wakeActual && day.wakeTarget ? formatDelta(clockDelta(day.wakeTarget, day.wakeActual)) : "not logged",
                },
                { k: "XP today", v: dayXp(day).toLocaleString() },
              ].map((c) => (
                <div key={c.k}>
                  <div className="kicker">{c.k}</div>
                  <div className="num mt-1.5 text-[22px]">{c.v}</div>
                  {c.sub ? <div className="text-[11px] text-[var(--ink-4)]">{c.sub}</div> : null}
                </div>
              ))}
            </div>
          </div>

          {secondsToBed > 0 ? (
            <div className="shrink-0 text-center">
              <Kicker>Until {bedTarget}</Kicker>
              <div className="num mono mt-2 text-[34px]" style={{ color: "var(--accent)" }}>
                {mounted ? formatCountdown(secondsToBed) : "--:--"}
              </div>
              <div className="mt-1 text-[11px] text-[var(--ink-4)]">
                Bedtime hit {bed.rate}% this week
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        {/* Debrief */}
        <div className="space-y-4 lg:col-span-7">
          <Kicker>Nightly debrief</Kicker>
          <div className="grid gap-4 sm:grid-cols-2">
            {QUESTIONS.map((q, i) => (
              <Panel key={q.key} className="rise p-5" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-2">
                  <Icon name={q.icon} className="h-3.5 w-3.5 text-[var(--ink-4)]" />
                  <span className="text-[13px] font-semibold tracking-tight">{q.label}</span>
                </div>
                <textarea
                  value={debrief[q.key]}
                  onChange={(e) => write({ [q.key]: e.target.value } as Partial<Debrief>)}
                  rows={4}
                  placeholder="Be specific. Vague reviews change nothing."
                  className="mt-3 w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[var(--ink-4)]"
                />
              </Panel>
            ))}
          </div>
          <Btn
            variant="accent"
            size="lg"
            icon="Check"
            onClick={closeDay}
            disabled={!debrief.wentWell.trim() && !debrief.didnt.trim()}
          >
            {day.debrief?.completedAt ? "Debrief saved" : "Close the day"}
          </Btn>
        </div>

        {/* Wind down + tomorrow */}
        <div className="space-y-5 lg:col-span-5">
          <Panel className="rise p-6">
            <Kicker>Wind down</Kicker>
            <ol className="mt-4 space-y-1">
              {NIGHT_STEPS.map((s) => {
                const done =
                  s.id === "debrief"
                    ? Boolean(day.debrief?.completedAt)
                    : s.id === "tomorrow"
                      ? tomorrowSet >= 2
                      : s.id === "prepare"
                        ? Boolean(day.habits.environment)
                        : Boolean(day.morning[`night:${s.id}`]);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                      style={{
                        borderColor: done ? "transparent" : "var(--hair)",
                        background: done ? "var(--accent)" : "transparent",
                        color: done ? "hsl(var(--a-h) 60% 8%)" : "var(--ink-4)",
                      }}
                    >
                      <Icon name={done ? "Check" : s.icon} className="h-3.5 w-3.5" strokeWidth={done ? 3 : 1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13.5px] ${done ? "text-[var(--ink-3)]" : ""}`}>{s.label}</span>
                      <span className="block text-[11.5px] text-[var(--ink-4)]">{s.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel className="rise p-6" style={{ borderColor: tomorrowSet >= 2 ? "var(--accent-line)" : undefined }}>
            <div className="flex items-center justify-between">
              <Kicker>Tomorrow&apos;s two</Kicker>
              <span className="text-[11px] text-[var(--ink-4)]">{shortDate(tomorrow)}</span>
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--hair)] bg-[var(--panel)] px-4 py-3">
                  <div className="kicker">#{i + 1}</div>
                  <input
                    value={tomorrowDay.priorities[i]?.title ?? ""}
                    onChange={(e) => setPriority(i, e.target.value, tomorrow)}
                    placeholder={i === 0 ? "The hardest thing, first" : "The second lever"}
                    className="mt-1 w-full bg-transparent text-[14.5px] outline-none placeholder:text-[var(--ink-4)]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2">
              {tomorrowSet >= 2 ? (
                <>
                  <Icon name="Check" className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <span className="text-[13px]" style={{ color: "var(--accent)" }}>
                    Tomorrow is ready.
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-[var(--ink-3)]">
                  Set both to close “Win Tomorrow Tonight”.
                </span>
              )}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
