"use client";

import { useMemo, useState } from "react";
import { HABIT_BY_ID } from "@/lib/life/habits";
import { addDays, monthOf, parseKey, shortDate } from "@/lib/life/date";
import {
  bestStreakIn,
  challengeProgress,
  dailyScore,
  getDay,
  report,
} from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { AreaChart, Heatmap, Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Delta, Kicker, Panel, SectionHeader } from "@/components/life/ui";

export default function MonthlyPage() {
  const { state, today } = useLife();
  const [offset, setOffset] = useState(0);

  const anchor = useMemo(() => {
    const d = parseKey(today);
    d.setMonth(d.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, [today, offset]);

  const keys = useMemo(() => monthOf(anchor).filter((k) => k <= today), [anchor, today]);
  const prevKeys = useMemo(() => {
    const d = parseKey(anchor);
    d.setMonth(d.getMonth() - 1, 1);
    return monthOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }, [anchor]);

  const r = useMemo(() => report(state, keys), [state, keys]);
  const prev = useMemo(() => report(state, prevKeys), [state, prevKeys]);
  const ch = challengeProgress(state, today);
  const best = bestStreakIn(state, keys);

  const monthName = parseKey(anchor).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const series = keys.map((k) => ({ label: shortDate(k), value: dailyScore(getDay(state, k)) }));
  const heat = keys.map((k) => ({
    key: k,
    value: dailyScore(getDay(state, k)) / 100,
    title: `${shortDate(k)} — ${dailyScore(getDay(state, k))}%`,
  }));

  /** The "1% better" read: this month's average day against last month's.
   *  Suppressed until the month has enough days to say anything honest. */
  const thin = r.loggedDays < 3;
  const improvement = !thin && prev.avgScore ? ((r.avgScore - prev.avgScore) / prev.avgScore) * 100 : null;

  const comparisons = [
    { k: "Average daily score", now: `${r.avgScore}%`, before: `${prev.avgScore}%`, delta: r.avgScore - prev.avgScore },
    {
      k: "Habits completed",
      now: `${r.habitsCompleted}`,
      before: `${prev.habitsCompleted}`,
      delta: r.habitsCompleted - prev.habitsCompleted,
    },
    { k: "Perfect days", now: `${r.perfectDays}`, before: `${prev.perfectDays}`, delta: r.perfectDays - prev.perfectDays },
    { k: "Wake-up consistency", now: `${r.wake.rate}%`, before: `${prev.wake.rate}%`, delta: r.wake.rate - prev.wake.rate },
    { k: "Bedtime consistency", now: `${r.bed.rate}%`, before: `${prev.bed.rate}%`, delta: r.bed.rate - prev.bed.rate },
    {
      k: "Learning sessions",
      now: `${r.learningSessions}`,
      before: `${prev.learningSessions}`,
      delta: r.learningSessions - prev.learningSessions,
    },
    { k: "Pages read", now: `${r.pages}`, before: `${prev.pages}`, delta: r.pages - prev.pages },
    {
      k: "Priorities closed",
      now: `${r.prioritiesDone}`,
      before: `${prev.prioritiesDone}`,
      delta: r.prioritiesDone - prev.prioritiesDone,
    },
    { k: "Momentum", now: `${r.momentumEnd}`, before: `${prev.momentumEnd}`, delta: r.momentumEnd - prev.momentumEnd },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Monthly life report"
        title="Your month"
        sub={monthName}
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

      <Panel className="rise relative overflow-hidden p-6 sm:p-10">
        <div
          className="pointer-events-none absolute -left-24 -top-32 h-[380px] w-[380px] rounded-full blur-3xl"
          style={{ background: "var(--accent-glow)", opacity: 0.4 }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-10">
          <div>
            <Kicker>1% better</Kicker>
            <div className="num mt-3 text-[clamp(3rem,10vw,5rem)] leading-none">
              {improvement === null ? "—" : `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%`}
            </div>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--ink-3)]">
              {improvement === null
                ? thin
                  ? `Only ${r.loggedDays} day${r.loggedDays === 1 ? "" : "s"} logged this month so far. The month-on-month read arrives once there is enough of the month to compare — until then, the daily score is the honest number.`
                  : "Not enough history to compare months yet. Keep logging — this becomes the most useful number in the app."
                : improvement >= 0
                  ? `Your average day this month was ${improvement.toFixed(1)}% better than last month. Compounded over a year, that is a different person.`
                  : `Your average day was ${Math.abs(improvement).toFixed(1)}% below last month. Not a verdict — a signal. One habit explains most of it.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-8">
            <Ring value={r.avgScore} size={168} thickness={10} gap={64}>
              <div>
                <div className="num text-[42px] leading-none">
                  <CountUp value={r.avgScore} />
                  <span className="text-[18px]">%</span>
                </div>
                <div className="kicker mt-1.5">Avg score</div>
              </div>
            </Ring>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 self-center">
              <Metric k="Days logged" v={r.loggedDays} />
              <Metric k="Habits completed" v={r.habitsCompleted} />
              <Metric k="Perfect days" v={r.perfectDays} />
              <Metric k="Longest streak" v={best ? `${best.length}` : "—"} sub={best ? HABIT_BY_ID[best.id].name : ""} />
              <Metric k="XP earned" v={r.xp.toLocaleString()} />
              <Metric k="Challenge" v={`${ch.progress}%`} sub={state.challenge.title} />
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Before vs now</Kicker>
          <div className="mt-5 space-y-1">
            <div className="flex items-center gap-4 px-2 pb-2 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
              <span className="flex-1">Metric</span>
              <span className="w-20 text-right">Last month</span>
              <span className="w-20 text-right">So far</span>
              <span className="w-20 text-right">Change</span>
            </div>
            {comparisons.map((c) => (
              <div key={c.k} className="flex items-center gap-4 rounded-xl px-2 py-2.5 text-[13px] hover:bg-[var(--panel)]">
                <span className="flex-1 truncate">{c.k}</span>
                <span className="num w-20 text-right text-[var(--ink-3)]">{c.before}</span>
                <span className="num w-20 text-right">{c.now}</span>
                <span className="w-20 text-right">
                  <Delta value={c.delta} />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-5">
          <Panel className="rise p-6">
            <Kicker>Every day this month</Kicker>
            <div className="mt-5">
              <Heatmap cells={heat} columns={7} />
            </div>
            <p className="mt-4 text-[12px] text-[var(--ink-4)]">Brighter is a higher daily score.</p>
          </Panel>

          <Panel className="rise p-6">
            <Kicker>North Star</Kicker>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="num text-[30px] leading-none">
                  {r.northStarEnd !== null ? r.northStarEnd.toLocaleString() : "—"}
                </div>
                <div className="mt-1.5 text-[12px] text-[var(--ink-3)]">{state.northStar.label}</div>
              </div>
              {r.northStarStart !== null && r.northStarEnd !== null && r.northStarStart !== 0 ? (
                <Chip tone={r.northStarEnd >= r.northStarStart ? "good" : "bad"}>
                  {(((r.northStarEnd - r.northStarStart) / Math.abs(r.northStarStart)) * 100).toFixed(1)}% this month
                </Chip>
              ) : null}
            </div>
          </Panel>
        </div>
      </section>

      <Panel className="rise p-6">
        <Kicker>Daily score through the month</Kicker>
        <div className="mt-5">
          {series.length > 1 ? (
            <AreaChart data={series} height={200} min={0} max={100} formatValue={(v) => `${Math.round(v)}%`} />
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--ink-3)]">
              One day in. The curve starts tomorrow.
            </p>
          )}
        </div>
      </Panel>

      <Panel className="rise flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="flex items-center gap-3">
          <Icon name="Trophy" className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <div>
            <div className="text-[14px] font-semibold">
              {r.bestDay ? `Best day: ${shortDate(r.bestDay.date)} at ${r.bestDay.score}%` : "No standout day yet"}
            </div>
            <div className="text-[12px] text-[var(--ink-3)]">
              {r.weakestHabit
                ? `Weakest habit: ${HABIT_BY_ID[r.weakestHabit.id].name} at ${r.weakestHabit.rate}%. That is next month's single focus.`
                : "Keep logging to surface the weak link."}
            </div>
          </div>
        </div>
        <span className="text-[12px] text-[var(--ink-4)]">
          {shortDate(keys[0])} — {shortDate(keys[keys.length - 1])} · {keys.length} day{keys.length === 1 ? "" : "s"}
        </span>
      </Panel>
    </div>
  );
}

function Metric({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className="num mt-1.5 text-[22px]">{v}</div>
      {sub ? <div className="mt-0.5 max-w-[140px] truncate text-[11px] text-[var(--ink-4)]">{sub}</div> : null}
    </div>
  );
}
