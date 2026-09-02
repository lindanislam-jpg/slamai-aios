"use client";

import { useMemo, useState } from "react";
import { HABITS, HABIT_BY_ID } from "@/lib/life/habits";
import { lastNDays, shortDate } from "@/lib/life/date";
import {
  completion,
  dailyScore,
  getDay,
  missStatus,
  momentum,
  momentumSeries,
  momentumStreak,
  recovery,
  rhythmScore,
} from "@/lib/life/engine";
import { useLife, useNow } from "@/lib/life/store";
import { AreaChart, MomentumFlow, Ring } from "@/components/life/charts";
import { Icon } from "@/components/life/icons";
import { Btn, Chip, CountUp, Delta, Kicker, Panel, SectionHeader, Segmented } from "@/components/life/ui";
import { RecoveryBanner } from "@/components/life/widgets";

const RANGES = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export default function MomentumPage() {
  const { state, today, toggleHabit, notify } = useLife();
  const now = useNow(30_000);
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");

  const m = momentum(state, today, now);
  const series = useMemo(() => momentumSeries(state, Number(range)), [state, range]);
  const scoreSeries = useMemo(
    () => lastNDays(Number(range), today).map((k) => ({ label: shortDate(k), value: dailyScore(getDay(state, k)) })),
    [state, range, today],
  );
  const rec = recovery(state, today);

  const misses = HABITS.map((h) => ({ habit: h, status: missStatus(state, h.id) })).filter(
    (r) => r.status !== "clean",
  );

  const headline =
    m.direction === "building"
      ? "BUILDING"
      : m.direction === "slipping"
        ? "SLIPPING"
        : "STABLE";

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Momentum engine"
        title="Motivation follows action."
        sub="Momentum is consistency, direction and rhythm in one number. It moves the moment you do."
        action={<Segmented value={range} onChange={setRange} options={[...RANGES]} />}
      />

      <Panel className="rise relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -left-16 -top-32 h-80 w-80 rounded-full blur-3xl"
          style={{
            background:
              m.direction === "slipping"
                ? "color-mix(in srgb, var(--bad) 22%, transparent)"
                : "var(--accent-glow)",
            opacity: 0.55,
          }}
        />
        <div className="relative flex flex-wrap items-center gap-10">
          <Ring
            value={m.score}
            size={200}
            thickness={11}
            gap={66}
            tone={m.direction === "slipping" ? "var(--bad)" : undefined}
          >
            <div>
              <div className="num text-[62px] leading-none">
                <CountUp value={m.score} />
              </div>
              <div className="kicker mt-1.5">Momentum</div>
            </div>
          </Ring>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className="display text-[clamp(1.8rem,5vw,2.8rem)] leading-none"
                style={{
                  color:
                    m.direction === "building"
                      ? "var(--good)"
                      : m.direction === "slipping"
                        ? "var(--bad)"
                        : "var(--ink)",
                }}
              >
                {headline}
              </h2>
              <Delta value={m.delta} />
            </div>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-[var(--ink-3)]">
              {m.direction === "building"
                ? "You are compounding. The cheapest way to keep this is to not break the chain tomorrow."
                : m.direction === "slipping"
                  ? "Catch it now. One small action today is worth more than a perfect plan for Monday."
                  : "Holding steady. Steady is fine — it is the floor you built. Pick one habit and lift it."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {[
                { k: "Consistency", v: m.consistency, hint: "7-day weighted completion" },
                { k: "Trend", v: m.trend, hint: "Last 3 days vs previous 4" },
                { k: "Rhythm", v: Math.round(rhythmScore(state)), hint: "Wake and bed accuracy" },
                { k: "Streak", v: momentumStreak(state), hint: "Days at 50%+" },
              ].map((c) => (
                <div key={c.k}>
                  <div className="kicker">{c.k}</div>
                  <div className="num mt-1.5 text-[24px]">{c.v}</div>
                  <div className="mt-1 text-[11px] leading-snug text-[var(--ink-4)]">{c.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-8 -mx-2">
          <MomentumFlow points={series} direction={m.direction} height={170} />
        </div>
        <div className="flex justify-between px-2 text-[10px] uppercase tracking-wider text-[var(--ink-4)]">
          <span>{shortDate(series[0].date)}</span>
          <span>Today</span>
        </div>
      </Panel>

      {m.direction === "slipping" && rec ? (
        <Panel className="rise p-6 sm:p-8" style={{ borderColor: "color-mix(in srgb, var(--bad) 40%, transparent)" }}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="kicker" style={{ color: "var(--bad)" }}>
                Momentum is falling
              </span>
              <h3 className="display mt-2 text-2xl">CATCH IT NOW.</h3>
              <p className="mt-2 max-w-md text-[13.5px] text-[var(--ink-3)]">
                One action. {rec.minutes} minutes. {rec.action}
              </p>
            </div>
            <Btn
              variant="accent"
              size="lg"
              icon="Play"
              onClick={() => {
                toggleHabit(rec.habitId);
                notify({
                  title: "Recovery logged",
                  body: `${HABIT_BY_ID[rec.habitId].name} is back on.`,
                  tone: "success",
                  xp: 20,
                });
              }}
            >
              Start recovery
            </Btn>
          </div>
        </Panel>
      ) : (
        <RecoveryBanner />
      )}

      <section className="grid gap-5 lg:grid-cols-12">
        <Panel className="rise p-6 lg:col-span-7">
          <Kicker>Daily score · {range} days</Kicker>
          <div className="mt-5">
            <AreaChart data={scoreSeries} height={200} min={0} max={100} formatValue={(v) => `${Math.round(v)}%`} />
          </div>
        </Panel>

        <Panel className="rise p-6 lg:col-span-5">
          <Kicker>Never miss twice</Kicker>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-3)]">
            Missing once is an accident. Missing twice is the start of a new habit — the wrong one.
          </p>
          <div className="mt-5 space-y-2.5">
            {misses.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--hair)] bg-[var(--panel)] px-4 py-5">
                <Icon name="ShieldCheck" className="h-5 w-5" style={{ color: "var(--good)" }} />
                <div>
                  <div className="text-[14px] font-semibold">Nothing missed twice.</div>
                  <div className="text-[12px] text-[var(--ink-3)]">The chain is intact across all eight habits.</div>
                </div>
              </div>
            ) : (
              misses.map(({ habit, status }) => (
                <div
                  key={habit.id}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor:
                      status === "danger"
                        ? "color-mix(in srgb, var(--bad) 35%, transparent)"
                        : "color-mix(in srgb, var(--warn) 30%, transparent)",
                    background:
                      status === "danger"
                        ? "color-mix(in srgb, var(--bad) 8%, transparent)"
                        : "color-mix(in srgb, var(--warn) 7%, transparent)",
                  }}
                >
                  <Icon
                    name={habit.icon}
                    className="h-4 w-4"
                    style={{ color: status === "danger" ? "var(--bad)" : "var(--warn)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{habit.name}</div>
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      {status === "danger" ? "Don't let a slip become a slide." : "Tomorrow is your recovery day."}
                    </div>
                  </div>
                  <Chip tone={status === "danger" ? "bad" : "warn"}>
                    {status === "danger" ? "Twice" : "Once"}
                  </Chip>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {HABITS.map((h) => (
          <Panel key={h.id} className="p-5">
            <div className="flex items-center gap-2.5">
              <Icon name={h.icon} className="h-4 w-4" style={{ color: `hsl(${h.hue} 78% 60%)` }} />
              <span className="truncate text-[13px] font-medium">{h.name}</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="num text-[24px]">{completion(state, h.id, 7)}%</div>
              <div className="text-[11px] text-[var(--ink-4)]">7 days</div>
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
