"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MORNING_STEPS } from "@/lib/life/habits";
import { clockToMinutes, formatCountdown, formatDelta, clockDelta, minutesToClock } from "@/lib/life/date";
import { getDay, morningProgress, protectedMorning, streak, wakeConsistency } from "@/lib/life/engine";
import { useLife, useMounted, useNow } from "@/lib/life/store";
import { useAlarm } from "@/components/life/AlarmLayer";
import { Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Kicker, Panel, SectionHeader } from "@/components/life/ui";

const BLOCKED = [
  { label: "News", icon: "MonitorSmartphone" },
  { label: "Social media", icon: "Smartphone" },
  { label: "Inbox", icon: "Bell" },
];

export default function MorningMode() {
  const { state, today, completeMorningStep, wakeUp, notify, setHabit } = useLife();
  const { ring } = useAlarm();
  const now = useNow(1000);
  const mounted = useMounted();

  const day = getDay(state, today);
  const progress = morningProgress(state, today);
  const guard = protectedMorning(state, now);
  const wakeTarget = day.wakeTarget ?? state.settings.wakeTime;
  const wakeBase = clockToMinutes(day.wakeActual ?? wakeTarget);
  const consistency = wakeConsistency(state, 7);

  const steps = useMemo(
    () =>
      MORNING_STEPS.map((s) => {
        const at = day.morning[s.id] ?? (s.id === "wake" ? day.wakeActual : undefined);
        return { ...s, at, planned: minutesToClock(wakeBase + s.offset), done: Boolean(at) };
      }),
    [day, wakeBase],
  );

  const complete = (id: string, label: string) => {
    completeMorningStep(id);
    const step = steps.find((s) => s.id === id);
    if (!step?.done) {
      if (step?.habit) setHabit(step.habit, true);
      notify({ title: `${label} done`, tone: "success", xp: 20 });
    }
  };

  const allDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Morning mode"
        title={allDone ? "Morning complete. The day is yours." : "Own the first hour."}
        sub="The world does not get a vote until this is finished."
        action={
          !day.wakeActual ? (
            <Btn
              variant="accent"
              icon="Sunrise"
              onClick={() => {
                wakeUp();
                setHabit("protect-morning", true);
                notify({
                  title: "Wake-up logged",
                  body: `${formatDelta(clockDelta(wakeTarget, now.toTimeString().slice(0, 5)))} against ${wakeTarget}.`,
                  tone: "success",
                  xp: 25,
                });
              }}
            >
              I&apos;m up
            </Btn>
          ) : (
            <Chip tone="accent">
              <Icon name="Check" className="h-3 w-3" /> Woke at {day.wakeActual}
            </Chip>
          )
        }
      />

      <section className="grid gap-5 lg:grid-cols-12">
        {/* Progress ring */}
        <Panel className="rise flex flex-col items-center justify-center p-8 lg:col-span-4">
          <Ring value={progress} size={230} thickness={12} gap={60}>
            <div>
              <div className="num text-[52px] leading-none">
                <CountUp value={progress} />
                <span className="text-[22px]">%</span>
              </div>
              <div className="kicker mt-2">Morning complete</div>
            </div>
          </Ring>
          <div className="mt-6 grid w-full grid-cols-2 gap-4 text-center">
            <div>
              <div className="kicker">Wake streak</div>
              <div className="num mt-1 text-[22px]">{streak(state, "protect-morning")}</div>
            </div>
            <div>
              <div className="kicker">On time (7d)</div>
              <div className="num mt-1 text-[22px]">{consistency.rate}%</div>
            </div>
          </div>
        </Panel>

        {/* Timeline */}
        <Panel className="rise p-6 sm:p-8 lg:col-span-8">
          <Kicker>The sequence</Kicker>
          <ol className="relative mt-5">
            <span className="absolute bottom-6 left-[19px] top-6 w-px bg-[var(--hair)]" aria-hidden />
            <span
              className="absolute left-[19px] top-6 w-px transition-all duration-700"
              style={{
                height: `calc(${progress}% - 12px)`,
                maxHeight: "calc(100% - 48px)",
                background: "linear-gradient(180deg, var(--accent), var(--accent-line))",
              }}
              aria-hidden
            />
            {steps.map((s, i) => (
              <li
                key={s.id}
                className="rise relative flex items-center gap-4 py-2.5"
                style={{ animationDelay: `${60 * i}ms` }}
              >
                <button
                  onClick={() => complete(s.id, s.label)}
                  aria-label={`${s.done ? "Undo" : "Complete"} ${s.label}`}
                  className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-300 active:scale-90"
                  style={{
                    borderColor: s.done ? "transparent" : "var(--hair-strong)",
                    background: s.done ? "var(--accent)" : "var(--bg)",
                    color: s.done ? "hsl(var(--a-h) 60% 8%)" : "var(--ink-3)",
                  }}
                >
                  <Icon name={s.done ? "Check" : s.icon} className="h-[17px] w-[17px]" strokeWidth={s.done ? 3 : 1.7} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[15px] font-medium tracking-tight", s.done && "text-[var(--ink-3)]")}>
                    {s.label}
                  </div>
                  <div className="text-[12px] text-[var(--ink-4)]">{s.detail}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[14px]">{s.at ?? s.planned}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
                    {s.at ? "done" : "planned"}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      {/* Protected morning */}
      <Panel className="rise relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "var(--accent-glow)", opacity: guard.active ? 0.6 : 0.2 }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Kicker>Protected morning</Kicker>
            <div className="num mono mt-3 text-[clamp(2.6rem,8vw,4rem)] leading-none" style={{ color: guard.active ? "var(--accent)" : undefined }}>
              {mounted ? (guard.active ? formatCountdown(guard.remaining) : day.wakeActual ? "COMPLETE" : "NOT STARTED") : "--:--"}
            </div>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[var(--ink-3)]">
              {guard.active
                ? `${state.settings.protectedMinutes} minutes that belong to you. Nothing outside this list gets in.`
                : day.wakeActual
                  ? "Your protected window is finished. The rest of the day is negotiable — that hour was not."
                  : "The window starts the moment you log your wake-up."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {BLOCKED.map((b) => (
              <div
                key={b.label}
                className="flex min-w-[130px] flex-1 flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center"
                style={{
                  borderColor: guard.active ? "color-mix(in srgb, var(--bad) 32%, transparent)" : "var(--hair)",
                  background: guard.active ? "color-mix(in srgb, var(--bad) 8%, transparent)" : "var(--panel)",
                }}
              >
                <span className="relative">
                  <Icon name={b.icon} className="h-6 w-6" style={{ color: guard.active ? "var(--bad)" : "var(--ink-4)" }} />
                  <span
                    className="absolute left-1/2 top-1/2 h-[1.5px] w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded"
                    style={{ background: guard.active ? "var(--bad)" : "var(--ink-4)" }}
                  />
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-wider">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
          <div
            className="h-full rounded-full transition-[width] duration-1000"
            style={{ width: `${guard.progress * 100}%`, background: "linear-gradient(90deg, var(--accent-line), var(--accent))" }}
          />
        </div>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/life/journal">
          <Panel hover className="h-full p-5">
            <Icon name="PenLine" className="h-5 w-5 text-[var(--ink-3)]" />
            <div className="mt-3 text-[15px] font-semibold tracking-tight">Clear your mind</div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Brain dump, today&apos;s two, gratitude.</p>
          </Panel>
        </Link>
        <Link href="/life/learning">
          <Panel hover className="h-full p-5">
            <Icon name="BookOpen" className="h-5 w-5 text-[var(--ink-3)]" />
            <div className="mt-3 text-[15px] font-semibold tracking-tight">Daily learning</div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">
              {state.book.dailyTarget} pages of {state.book.title}.
            </p>
          </Panel>
        </Link>
        <Panel hover className="h-full cursor-pointer p-5" onClick={() => ring("wake", { test: true })}>
          <Icon name="AlarmClock" className="h-5 w-5 text-[var(--ink-3)]" />
          <div className="mt-3 text-[15px] font-semibold tracking-tight">Preview wake-up mode</div>
          <p className="mt-1 text-[12px] text-[var(--ink-3)]">See exactly what {state.settings.wakeTime} looks like.</p>
        </Panel>
      </section>
    </div>
  );
}
