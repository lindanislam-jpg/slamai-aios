"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HABITS, HABIT_BY_ID } from "@/lib/life/habits";
import { lastNDays, shortDate, weekdayShort } from "@/lib/life/date";
import {
  completion,
  dailyScore,
  getDay,
  habitTrend,
  habitsDone,
  lastCompleted,
  longestStreak,
  missStatus,
  streak,
} from "@/lib/life/engine";
import { useLife } from "@/lib/life/store";
import { Bars, Heatmap, SegmentRing, Spark } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Kicker, Modal, Panel, SectionHeader } from "@/components/life/ui";
import { HabitCard } from "@/components/life/widgets";
import type { HabitId } from "@/lib/life/types";

export default function HabitsPage() {
  const { state, today } = useLife();
  const [open, setOpen] = useState<HabitId | null>(null);
  const day = getDay(state, today);
  const done = habitsDone(day);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Habit command center"
        title="Eight habits. One system."
        sub="Tap a card to open its analytics. Tap the circle to complete it."
      />

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise flex flex-col items-center justify-center p-8 lg:col-span-4">
          <SegmentRing
            size={250}
            thickness={13}
            segments={HABITS.map((h) => ({
              id: h.id,
              done: Boolean(day.habits[h.id]),
              hue: h.hue,
              label: h.name,
            }))}
            onSegmentClick={(id) => setOpen(id as HabitId)}
          >
            <div>
              <div className="num text-[54px] leading-none">
                <CountUp value={done} />
                <span className="text-[26px] text-[var(--ink-4)]">/8</span>
              </div>
              <div className="kicker mt-2">Habits complete</div>
              <div className="mt-1 text-[12px] text-[var(--ink-3)]">{dailyScore(day)}% daily score</div>
            </div>
          </SegmentRing>
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {HABITS.map((h) => (
              <button
                key={h.id}
                onClick={() => setOpen(h.id)}
                title={h.name}
                className="h-2 w-8 rounded-full transition-transform hover:scale-110"
                style={{
                  background: day.habits[h.id] ? `hsl(${h.hue} 78% 58%)` : "var(--panel-strong)",
                }}
              />
            ))}
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-8">
          <Kicker>Consistency · last 7 days</Kicker>
          <div className="mt-6 space-y-3.5">
            {HABITS.map((h) => {
              const week = completion(state, h.id, 7);
              const s = streak(state, h.id);
              const miss = missStatus(state, h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => setOpen(h.id)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <span className="w-[150px] shrink-0 truncate text-[13px] font-medium sm:w-[190px]">{h.name}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                      style={{
                        width: `${week}%`,
                        background: `linear-gradient(90deg, hsl(${h.hue} 70% 45% / 0.55), hsl(${h.hue} 78% 58%))`,
                      }}
                    />
                  </span>
                  <span className="num w-10 shrink-0 text-right text-[13px]">{week}%</span>
                  <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-[12px] text-[var(--ink-4)] sm:flex">
                    <Icon name="Flame" className="h-3 w-3" />
                    {s}
                  </span>
                  <span className="w-[86px] shrink-0 text-right">
                    {miss === "danger" ? (
                      <Chip tone="bad">Twice</Chip>
                    ) : miss === "missed-once" ? (
                      <Chip tone="warn">Once</Chip>
                    ) : (
                      <Chip tone="good">Clean</Chip>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {HABITS.map((h) => (
          <HabitCard key={h.id} id={h.id} onOpen={setOpen} />
        ))}
      </div>

      <HabitDetail id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function HabitDetail({ id, onClose }: { id: HabitId | null; onClose: () => void }) {
  const { state, today, toggleHabit } = useLife();

  const data = useMemo(() => {
    if (!id) return null;
    const habit = HABIT_BY_ID[id];
    const heat = lastNDays(91, today).map((k) => ({
      key: k,
      value: state.days[k]?.habits[id] ? 1 : 0,
      title: `${shortDate(k)} — ${state.days[k]?.habits[id] ? "done" : "missed"}`,
    }));
    const weekBars = lastNDays(7, today).map((k) => ({
      label: weekdayShort(k).slice(0, 1),
      value: state.days[k]?.habits[id] ? 100 : 0,
      highlight: Boolean(state.days[k]?.habits[id]),
    }));
    const trail = lastNDays(30, today).map((k, i, arr) =>
      Math.round(
        (arr.slice(Math.max(0, i - 6), i + 1).filter((kk) => state.days[kk]?.habits[id]).length /
          Math.min(7, i + 1)) *
          100,
      ),
    );
    return { habit, heat, weekBars, trail };
  }, [id, state.days, today]);

  if (!id || !data) return null;
  const { habit } = data;
  const done = Boolean(state.days[today]?.habits[id]);

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="flex items-start gap-4">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border"
          style={{
            borderColor: `hsl(${habit.hue} 60% 55% / 0.4)`,
            background: `hsl(${habit.hue} 70% 50% / 0.14)`,
            color: `hsl(${habit.hue} 78% 60%)`,
          }}
        >
          <Icon name={habit.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Kicker>Habit {String(habit.index).padStart(2, "0")}</Kicker>
          <h3 className="display mt-1.5 text-2xl leading-tight">{habit.name}</h3>
          <p className="mt-1 text-[13px]" style={{ color: `hsl(${habit.hue} 60% 62%)` }}>
            {habit.principle}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)]">
          <Icon name="X" className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-5 text-[14px] leading-relaxed text-[var(--ink-2)]">{habit.description}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { k: "Current streak", v: streak(state, id) },
          { k: "Longest streak", v: longestStreak(state, id) },
          { k: "7 days", v: `${completion(state, id, 7)}%` },
          { k: "30 days", v: `${completion(state, id, 30)}%` },
        ].map((c) => (
          <div key={c.k} className="rounded-2xl border border-[var(--hair)] bg-[var(--panel)] p-4">
            <div className="kicker">{c.k}</div>
            <div className="num mt-1.5 text-[22px]">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <Kicker>This week</Kicker>
          <div className="mt-3">
            <Bars data={data.weekBars} height={90} formatValue={(v) => (v ? "Done" : "Missed")} />
          </div>
        </div>
        <div>
          <Kicker>7-day rolling rate</Kicker>
          <div className="mt-3">
            <Spark points={data.trail} width={260} height={80} tone={`hsl(${habit.hue} 78% 58%)`} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Kicker>13 weeks</Kicker>
        <div className="mt-3">
          <Heatmap cells={data.heat} columns={13} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] pt-5">
        <div className="text-[12px] text-[var(--ink-3)]">
          Trend {habitTrend(state, id) >= 0 ? "+" : ""}
          {habitTrend(state, id)}% · Last completed{" "}
          {lastCompleted(state, id) ? shortDate(lastCompleted(state, id) as string) : "never"}
        </div>
        <div className="flex gap-2">
          <Link href={habit.href} onClick={onClose}>
            <Btn size="sm" variant="ghost" iconRight="ArrowRight">
              Open
            </Btn>
          </Link>
          <Btn size="sm" variant={done ? "ghost" : "accent"} icon="Check" onClick={() => toggleHabit(id)}>
            {done ? "Mark not done" : "Complete today"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
