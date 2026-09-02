"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HABITS } from "@/lib/life/habits";
import {
  challengeProgress,
  dailyScore,
  getDay,
  habitsDone,
  levelFor,
  momentum,
  momentumSeries,
  momentumStreak,
  northStarLatest,
  learningStreak,
  totalXp,
} from "@/lib/life/engine";
import { buildBriefing } from "@/lib/life/coach";
import { greeting, longDate, shortDate } from "@/lib/life/date";
import { useLife, useMounted, useNow } from "@/lib/life/store";
import { MomentumFlow, Ring, SegmentRing } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Delta, Kicker, Panel, SectionHeader } from "@/components/life/ui";
import {
  DemoBadge,
  HabitCard,
  HabitStrip,
  MiniStat,
  NextActionPanel,
  PriorityCard,
  RecoveryBanner,
  TimelineRail,
} from "@/components/life/widgets";

export default function CommandCenter() {
  const { state, today } = useLife();
  const mounted = useMounted();
  const now = useNow(1000);

  const day = getDay(state, today);
  const m = momentum(state, today, now);
  const flow = useMemo(() => momentumSeries(state, 30), [state]);
  const score = dailyScore(day);
  const done = habitsDone(day);
  const streakDays = momentumStreak(state);
  const briefing = useMemo(() => buildBriefing(state, now), [state, now]);
  const ns = northStarLatest(state);
  const ch = challengeProgress(state, today);
  const { level } = levelFor(totalXp(state));

  return (
    <div className="space-y-6">
      {/* ---------------- Header ---------------- */}
      <header className="rise flex flex-wrap items-end justify-between gap-6 pt-2">
        <div>
          <h1 className="display text-[clamp(1.9rem,5vw,3.1rem)] uppercase leading-[1.02]">
            {mounted ? greeting(now) : "Good morning"},{" "}
            <span style={{ color: "var(--accent)" }}>{state.profile.name}.</span>
          </h1>
          <p className="mt-3 text-[15px] text-[var(--ink-3)]">Become 1% better than yesterday.</p>
        </div>
        <div className="flex items-center gap-4">
          <DemoBadge />
          <div className="sm:text-right">
            <div className="num text-[26px] leading-none">{mounted ? now.toTimeString().slice(0, 8) : "--:--:--"}</div>
            <div className="mt-1.5 whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-[var(--ink-4)]">
              {mounted ? longDate(now) : ""}
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- Momentum + today's progress ---------------- */}
      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise relative overflow-hidden p-6 sm:p-8 lg:col-span-8">
          <div className="flex items-center justify-between gap-4">
            <Kicker>Daily momentum score</Kicker>
            <Chip tone={m.direction === "building" ? "good" : m.direction === "slipping" ? "bad" : "default"}>
              <Icon
                name={m.direction === "building" ? "TrendingUp" : m.direction === "slipping" ? "TrendingDown" : "Minus"}
                className="h-3 w-3"
              />
              {m.direction.toUpperCase()}
            </Chip>
          </div>

          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <Ring value={m.score} size={168} thickness={9} gap={70} className="shrink-0">
              <div>
                <div className="num text-[52px] leading-none">
                  <CountUp value={m.score} />
                </div>
                <div className="mt-1 text-[12px] text-[var(--ink-4)]">/ 100</div>
              </div>
            </Ring>

            <div className="w-full min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Delta value={m.delta} />
                <span className="text-[12px] text-[var(--ink-3)]">from yesterday</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{ borderColor: "var(--accent-line)", background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Icon name="Flame" className="h-3.5 w-3.5" />
                  {streakDays} day streak
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { k: "Consistency", v: m.consistency },
                  { k: "Trend", v: m.trend },
                  { k: "Rhythm", v: m.rhythm },
                ].map((c) => (
                  <div key={c.k} className="min-w-0">
                    <div className="kicker truncate">{c.k}</div>
                    <div className="num mt-1 text-[19px]">{c.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 -mx-2">
            <MomentumFlow points={flow} direction={m.direction} height={130} />
          </div>
          <div className="flex justify-between px-2 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
            <span>{shortDate(flow[0].date)}</span>
            <span>30 days</span>
            <span>Today</span>
          </div>
        </Panel>

        <Panel className="rise flex flex-col items-center justify-center p-6 lg:col-span-4">
          <Kicker>Today&apos;s progress</Kicker>
          <SegmentRing
            size={210}
            thickness={11}
            segments={HABITS.map((h) => ({
              id: h.id,
              done: Boolean(day.habits[h.id]),
              hue: h.hue,
              label: `${h.name} — ${day.habits[h.id] ? "complete" : "open"}`,
            }))}
          >
            <div>
              <div className="num text-[46px] leading-none">
                <CountUp value={score} />
                <span className="text-[20px]">%</span>
              </div>
              <div className="kicker mt-2">
                {done} / {HABITS.length} habits
              </div>
            </div>
          </SegmentRing>
          <Link href="/life/habits" className="mt-4">
            <Btn size="sm" variant="ghost" iconRight="ArrowRight">
              Habit command center
            </Btn>
          </Link>
        </Panel>
      </section>

      {/* ---------------- Next action ---------------- */}
      <div className="rise">
        <NextActionPanel />
      </div>

      <RecoveryBanner />

      {/* ---------------- Today hero + live routine ---------------- */}
      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 sm:p-8 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Kicker>Today</Kicker>
              <h2 className="display mt-3 text-[clamp(1.5rem,3.4vw,2.2rem)] leading-[1.15]">
                2 priorities.
                <br />
                8 habits.
                <br />
                <span style={{ color: "var(--accent)" }}>1 mission.</span>
              </h2>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[var(--ink-3)]">{state.profile.mission}</p>
              <div className="mt-6 max-w-md">
                <Kicker className="mb-3">The eight</Kicker>
                <HabitStrip />
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <PriorityCard index={0} />
              <PriorityCard index={1} />
              <Link href="/life/tasks" className="inline-block">
                <Btn size="sm" variant="ghost" iconRight="ArrowRight">
                  Open tasks
                </Btn>
              </Link>
            </div>
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-4">
          <div className="text-center">
            <div className="num text-[clamp(2.6rem,7vw,3.4rem)] leading-none">
              {mounted ? now.toTimeString().slice(0, 5) : "--:--"}
            </div>
            <div className="mt-2 text-[13px] text-[var(--ink-2)]">
              {mounted ? now.toLocaleDateString(undefined, { weekday: "long" }) : ""}
            </div>
            <div className="text-[12px] text-[var(--ink-4)]">
              {mounted ? now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : ""}
            </div>
          </div>
          <div className="hairline my-5" />
          <Kicker className="mb-2">Next</Kicker>
          <TimelineRail limit={6} />
        </Panel>
      </section>

      {/* ---------------- Briefing + key metrics ---------------- */}
      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 sm:p-8 lg:col-span-7">
          <SectionHeader
            kicker="Your daily briefing"
            title="The whole day, in six lines."
            sub="Generated from your habits, priorities, rhythm and North Star."
          />
          <div className="mt-6 space-y-4">
            <BriefRow icon="Compass" label="Today's mission" value={briefing.mission} />
            <BriefRow
              icon="Flag"
              label="Top two priorities"
              value={
                briefing.priorities.length
                  ? briefing.priorities.join("  ·  ")
                  : "Not set — decide them now, or tonight for tomorrow."
              }
            />
            <BriefRow icon="Shield" label="One thing to avoid" value={briefing.avoid} />
            <BriefRow icon="Mountain" label="One hard thing" value={briefing.hardThing} />
            <BriefRow icon="Target" label="North Star" value={briefing.northStar} />
            <BriefRow icon="Activity" label="Momentum" value={`${briefing.momentum} — ${m.direction}`} />
          </div>
        </Panel>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:content-start">
          <MiniStat
            label="North Star"
            icon="Target"
            href="/life/north-star"
            value={
              ns
                ? `${state.northStar.unitPosition === "prefix" ? state.northStar.unit : ""}${ns.value.toLocaleString()}${
                    state.northStar.unitPosition === "suffix" ? ` ${state.northStar.unit}` : ""
                  }`
                : "—"
            }
            sub={`${state.northStar.label} · target ${state.northStar.target.toLocaleString()}`}
          />
          <MiniStat
            label="Choose hard"
            icon="Mountain"
            href="/life/choose-hard"
            value={`${ch.progress}%`}
            sub={`${state.challenge.title} · ${ch.daysRemaining} days left`}
          />
          <MiniStat
            label="Learning streak"
            icon="BookOpen"
            href="/life/learning"
            value={`${learningStreak(state)}`}
            sub={`${state.book.title} · ${state.book.dailyTarget} pages a day`}
          />
          <MiniStat
            label="Level"
            icon="Zap"
            href="/life/progress"
            value={level}
            sub={`${totalXp(state).toLocaleString()} XP earned`}
          />
        </div>
      </section>

      {/* ---------------- Habits ---------------- */}
      <section className="space-y-5">
        <SectionHeader
          kicker="The eight habits"
          title="Habit command center"
          sub="Every habit, its streak, and how it is trending. Tap the circle to complete."
          action={
            <Link href="/life/habits">
              <Btn size="sm" variant="ghost" iconRight="ArrowRight">
                Full analytics
              </Btn>
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HABITS.map((h) => (
            <HabitCard key={h.id} id={h.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BriefRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--hair)] bg-[var(--panel)] text-[var(--ink-3)]">
        <Icon name={icon} className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <div className="kicker">{label}</div>
        <p className="mt-1 text-[14px] leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
