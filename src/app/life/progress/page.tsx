"use client";

import { useMemo, useState } from "react";
import { HABITS, HABIT_BY_ID } from "@/lib/life/habits";
import { lastNDays, shortDate } from "@/lib/life/date";
import {
  completion,
  dailyScore,
  getDay,
  levelFor,
  longestStreak,
  momentumSeries,
  northStarSeries,
  perfectDays,
  streak,
  totalXp,
  visibleDays,
} from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { AreaChart, Heatmap, MomentumFlow, Spark } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Bar, CountUp, Kicker, Panel, SectionHeader, Segmented } from "@/components/life/ui";

const RANGES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
] as const;

export default function ProgressPage() {
  const { state, today } = useLife();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("90");
  const n = Number(range);

  const days = visibleDays(state);
  const logged = Object.keys(days).length;
  const xp = totalXp(state);
  const { level, into, span } = levelFor(xp);

  const scoreSeries = useMemo(
    () => lastNDays(n, today).map((k) => ({ label: shortDate(k), value: dailyScore(getDay(state, k)) })),
    [state, n, today],
  );
  const flow = useMemo(() => momentumSeries(state, n, today), [state, n, today]);
  const heat = useMemo(
    () =>
      lastNDays(n, today).map((k) => ({
        key: k,
        value: dailyScore(getDay(state, k)) / 100,
        title: `${shortDate(k)} — ${dailyScore(getDay(state, k))}%`,
      })),
    [state, n, today],
  );
  const ns = useMemo(
    () => northStarSeries(state, n, today).map((p) => ({ label: shortDate(p.date), value: p.value })),
    [state, n, today],
  );

  const totalHabits = Object.values(days).reduce(
    (acc, d) => acc + HABITS.filter((h) => d.habits[h.id]).length,
    0,
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Progress"
        title="The long view."
        sub="Individual days lie. The curve does not."
        action={<Segmented value={range} onChange={setRange} options={[...RANGES]} />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="rise p-5">
          <Kicker>Level</Kicker>
          <div className="num mt-2.5 text-[32px] leading-none">
            <CountUp value={level} />
          </div>
          <Bar value={(into / span) * 100} className="mt-4" />
          <div className="mt-2 text-[11px] text-[var(--ink-4)]">
            {into.toLocaleString()} / {span.toLocaleString()} XP to level {level + 1}
          </div>
        </Panel>
        <Panel className="rise p-5">
          <Kicker>Total XP</Kicker>
          <div className="num mt-2.5 text-[32px] leading-none">{xp.toLocaleString()}</div>
          <div className="mt-2 text-[11px] text-[var(--ink-4)]">Across {logged} logged days</div>
        </Panel>
        <Panel className="rise p-5">
          <Kicker>Habits completed</Kicker>
          <div className="num mt-2.5 text-[32px] leading-none">{totalHabits.toLocaleString()}</div>
          <div className="mt-2 text-[11px] text-[var(--ink-4)]">All time</div>
        </Panel>
        <Panel className="rise p-5">
          <Kicker>Perfect days</Kicker>
          <div className="num mt-2.5 text-[32px] leading-none">{perfectDays(state)}</div>
          <div className="mt-2 text-[11px] text-[var(--ink-4)]">Eight of eight</div>
        </Panel>
      </section>

      <Panel className="rise p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Kicker>Momentum curve</Kicker>
          <span className="text-[12px] text-[var(--ink-3)]">{range} days</span>
        </div>
        <div className="mt-6 -mx-2">
          <MomentumFlow points={flow} height={200} direction="stable" />
        </div>
        <div className="flex justify-between px-2 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
          <span>{shortDate(flow[0].date)}</span>
          <span>Today</span>
        </div>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Daily score</Kicker>
          <div className="mt-5">
            <AreaChart data={scoreSeries} height={200} min={0} max={100} formatValue={(v) => `${Math.round(v)}%`} />
          </div>
        </Panel>
        <Panel className="rise p-6 lg:col-span-5">
          <Kicker>Consistency calendar</Kicker>
          <div className="mt-5">
            <Heatmap cells={heat} columns={n > 90 ? 20 : 13} />
          </div>
        </Panel>
      </section>

      {ns.length > 1 ? (
        <Panel className="rise p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Kicker>{state.northStar.label}</Kicker>
            <span className="text-[12px] text-[var(--ink-3)]">Target {state.northStar.target.toLocaleString()}</span>
          </div>
          <div className="mt-5">
            <AreaChart data={ns} height={200} target={state.northStar.target} />
          </div>
        </Panel>
      ) : null}

      <section className="space-y-4">
        <Kicker>Every habit, all time</Kicker>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HABITS.map((h) => {
            const trail = lastNDays(n, today).map((k, i, arr) =>
              Math.round(
                (arr.slice(Math.max(0, i - 6), i + 1).filter((kk) => state.days[kk]?.habits[h.id]).length /
                  Math.min(7, i + 1)) *
                  100,
              ),
            );
            return (
              <Panel key={h.id} className="p-5">
                <div className="flex items-center gap-2.5">
                  <Icon name={h.icon} className="h-4 w-4" style={{ color: `hsl(${h.hue} 78% 60%)` }} />
                  <span className="truncate text-[13px] font-medium">{h.name}</span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="num text-[24px] leading-none">{completion(state, h.id, n)}%</div>
                    <div className="mt-1.5 text-[11px] text-[var(--ink-4)]">
                      Streak {streak(state, h.id)} · best {longestStreak(state, h.id)}
                    </div>
                  </div>
                  <Spark points={trail} width={92} height={34} tone={`hsl(${h.hue} 78% 58%)`} />
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <Panel className="rise flex flex-wrap items-center justify-between gap-4 p-5">
        <span className="text-[12.5px] text-[var(--ink-3)]">
          Habit of the moment:{" "}
          <span className="font-medium text-[var(--ink)]">
            {HABIT_BY_ID[[...HABITS].sort((a, b) => streak(state, b.id) - streak(state, a.id))[0].id].name}
          </span>
        </span>
        <span className="text-[12.5px] text-[var(--ink-4)]">
          {logged} days of history · {state.settings.showDemoHistory ? "including demo data" : "your data only"}
        </span>
      </Panel>
    </div>
  );
}
