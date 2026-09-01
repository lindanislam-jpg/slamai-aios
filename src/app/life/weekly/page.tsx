"use client";

import { useMemo, useState } from "react";
import { HABITS, HABIT_BY_ID } from "@/lib/life/habits";
import { addDays, shortDate, weekOf, weekdayShort } from "@/lib/life/date";
import { bestStreakIn, dailyScore, getDay, momentumSeries, report } from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { AreaChart, Bars, Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Delta, Kicker, Panel, SectionHeader } from "@/components/life/ui";

export default function WeeklyPage() {
  const { state, today } = useLife();
  const [offset, setOffset] = useState(0);

  const anchor = addDays(today, offset * 7);
  const keys = useMemo(() => weekOf(anchor).filter((k) => k <= today), [anchor, today]);
  const r = useMemo(() => report(state, keys), [state, keys]);
  const prev = useMemo(() => report(state, weekOf(addDays(anchor, -7))), [state, anchor]);

  const bars = keys.map((k) => ({
    label: weekdayShort(k).slice(0, 1),
    value: dailyScore(getDay(state, k)),
    highlight: k === today,
  }));

  const momentumPoints = useMemo(
    () => momentumSeries(state, keys.length, keys[keys.length - 1]).map((p) => ({ label: shortDate(p.date), value: p.value })),
    [state, keys],
  );

  const best = bestStreakIn(state, keys);
  const scoreDelta = r.avgScore - prev.avgScore;

  const lesson =
    r.weakestHabit && r.weakestHabit.rate < 60
      ? `${HABIT_BY_ID[r.weakestHabit.id].name} ran at ${r.weakestHabit.rate}%. That single habit is the difference between this week and a great one.`
      : r.bed.rate < 60
        ? `Bedtime landed on time only ${r.bed.rate}% of nights, averaging ${r.bed.avgDelta} minutes late. The mornings are paying for it.`
        : "Nothing broke. The work now is holding this rhythm when the week gets busy.";

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Weekly analytics"
        title="This week"
        sub={`${shortDate(keys[0])} — ${shortDate(keys[keys.length - 1])}`}
        action={
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="ghost" icon="ChevronLeft" onClick={() => setOffset((o) => o - 1)}>
              Previous
            </Btn>
            <Btn size="sm" variant="ghost" iconRight="ChevronRight" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}>
              Next
            </Btn>
          </div>
        }
      />

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise flex flex-col items-center justify-center p-8 lg:col-span-4">
          <Ring value={r.avgScore} size={200} thickness={11} gap={64}>
            <div>
              <div className="num text-[52px] leading-none">
                <CountUp value={r.avgScore} />
                <span className="text-[22px]">%</span>
              </div>
              <div className="kicker mt-2">Average score</div>
            </div>
          </Ring>
          <div className="mt-5 flex items-center gap-2">
            <Delta value={scoreDelta} suffix="%" />
            <span className="text-[12px] text-[var(--ink-3)]">vs last week</span>
          </div>
          <div className="mt-6 grid w-full grid-cols-2 gap-4">
            <Stat k="Habits" v={`${r.habitsCompleted}/${r.possible}`} />
            <Stat k="Perfect days" v={r.perfectDays} />
            <Stat k="Priorities" v={`${r.prioritiesDone}/${r.prioritiesSet}`} />
            <Stat k="XP" v={r.xp.toLocaleString()} />
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-8">
          <Kicker>Daily score</Kicker>
          <div className="mt-6">
            <Bars data={bars} height={170} />
          </div>
          <div className="hairline my-6" />
          <Kicker>Momentum through the week</Kicker>
          <div className="mt-4">
            <AreaChart data={momentumPoints} height={140} min={0} max={100} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Highlight
          icon="Trophy"
          label="Best day"
          value={r.bestDay ? shortDate(r.bestDay.date) : "—"}
          sub={r.bestDay ? `${r.bestDay.score}% · ${weekdayShort(r.bestDay.date)}` : "No data yet"}
          tone="var(--good)"
        />
        <Highlight
          icon="TrendingDown"
          label="Weakest day"
          value={r.weakestDay ? shortDate(r.weakestDay.date) : "—"}
          sub={r.weakestDay ? `${r.weakestDay.score}% · ${weekdayShort(r.weakestDay.date)}` : "No data yet"}
          tone="var(--bad)"
        />
        <Highlight
          icon="Flame"
          label="Biggest win"
          value={best ? `${best.length} day${best.length === 1 ? "" : "s"}` : "—"}
          sub={best ? HABIT_BY_ID[best.id].name : ""}
          tone="var(--accent)"
        />
        <Highlight
          icon="Sparkles"
          label="Biggest lesson"
          value={r.weakestHabit ? `${r.weakestHabit.rate}%` : "—"}
          sub={r.weakestHabit ? HABIT_BY_ID[r.weakestHabit.id].name : ""}
          tone="var(--warn)"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Habit completion</Kicker>
          <div className="mt-5 space-y-3">
            {HABITS.map((h) => {
              const done = keys.filter((k) => state.days[k]?.habits[h.id]).length;
              const rate = keys.length ? Math.round((done / keys.length) * 100) : 0;
              return (
                <div key={h.id} className="flex items-center gap-4">
                  <span className="w-[150px] shrink-0 truncate text-[13px] sm:w-[200px]">{h.name}</span>
                  <span className="flex flex-1 gap-1">
                    {keys.map((k) => (
                      <span
                        key={k}
                        title={`${weekdayShort(k)} — ${state.days[k]?.habits[h.id] ? "done" : "missed"}`}
                        className="h-6 flex-1 rounded-[5px]"
                        style={{
                          background: state.days[k]?.habits[h.id]
                            ? `hsl(${h.hue} 74% 55%)`
                            : "var(--panel-strong)",
                        }}
                      />
                    ))}
                  </span>
                  <span className="num w-10 shrink-0 text-right text-[13px]">{rate}%</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-5">
          <Panel className="rise p-6">
            <Kicker>Rhythm</Kicker>
            <div className="mt-5 space-y-5">
              <Rhythm label="Wake-up consistency" rate={r.wake.rate} delta={r.wake.avgDelta} samples={r.wake.samples} />
              <Rhythm label="Bedtime consistency" rate={r.bed.rate} delta={r.bed.avgDelta} samples={r.bed.samples} />
            </div>
            <div className="hairline my-5" />
            <div className="grid grid-cols-2 gap-4">
              <Stat k="Learning sessions" v={r.learningSessions} />
              <Stat k="Pages read" v={r.pages} />
              <Stat k="North Star start" v={r.northStarStart?.toLocaleString() ?? "—"} />
              <Stat k="North Star end" v={r.northStarEnd?.toLocaleString() ?? "—"} />
            </div>
          </Panel>

          <Panel className="rise p-6">
            <div className="flex items-center gap-2">
              <Icon name="Sparkles" className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <Kicker>The week in one sentence</Kicker>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed">{lesson}</p>
            {r.strongestHabit ? (
              <Chip tone="good" className="mt-4">
                Strongest: {HABIT_BY_ID[r.strongestHabit.id].name} · {r.strongestHabit.rate}%
              </Chip>
            ) : null}
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
      <div className="kicker">{k}</div>
      <div className="num mt-1.5 text-[19px]">{v}</div>
    </div>
  );
}

function Highlight({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub: string;
  tone: string;
}) {
  return (
    <Panel className="rise p-5">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="h-4 w-4" style={{ color: tone }} />
        <span className="kicker">{label}</span>
      </div>
      <div className="num mt-3 text-[24px] leading-none">{value}</div>
      <div className="mt-2 truncate text-[12px] text-[var(--ink-3)]">{sub}</div>
    </Panel>
  );
}

function Rhythm({ label, rate, delta, samples }: { label: string; rate: number; delta: number; samples: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px]">{label}</span>
        <span className="num text-[15px]">{samples ? `${rate}%` : "—"}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${rate}%`,
            background: rate >= 70 ? "var(--good)" : rate >= 40 ? "var(--warn)" : "var(--bad)",
          }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-4)]">
        {samples ? `${delta >= 0 ? "+" : ""}${delta} min average · ${samples} logged` : "Nothing logged this week"}
      </div>
    </div>
  );
}
