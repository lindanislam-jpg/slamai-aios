"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { HABITS, HABIT_BY_ID } from "@/lib/life/habits";
import {
  buildTimeline,
  completion,
  dailyScore,
  getDay,
  habitTrend,
  lastCompleted,
  missStatus,
  nextAction,
  recovery,
  streak,
  type TimelineItem,
} from "@/lib/life/engine";
import { daysBetween, lastNDays } from "@/lib/life/date";
import { useLife, useNow } from "@/lib/life/store";
import { Icon } from "./icons";
import { Bar, Btn, Chip, Panel } from "./ui";
import { Spark } from "./charts";
import type { HabitId } from "@/lib/life/types";

/* ------------------------------------------------------------------ *
 * Habit card
 * ------------------------------------------------------------------ */

export function HabitCard({
  id,
  compact = false,
  onOpen,
}: {
  id: HabitId;
  compact?: boolean;
  onOpen?: (id: HabitId) => void;
}) {
  const { state, today, toggleHabit, notify } = useLife();
  const habit = HABIT_BY_ID[id];
  const day = getDay(state, today);
  const done = Boolean(day.habits[id]);
  const s = streak(state, id);
  const week = completion(state, id, 7);
  const month = completion(state, id, 30);
  const trend = habitTrend(state, id);
  const last = lastCompleted(state, id);
  const miss = missStatus(state, id);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleHabit(id);
    if (!done) {
      notify({
        title: `${habit.name}`,
        body: s + 1 > 1 ? `${s + 1} day streak.` : "Streak started.",
        tone: "success",
        xp: 20,
      });
    }
  };

  const accent = `hsl(${habit.hue} 78% 58%)`;

  return (
    <Panel
      hover
      onClick={() => onOpen?.(id)}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden p-5",
        compact ? "gap-3" : "gap-5",
      )}
      style={done ? { borderColor: `hsl(${habit.hue} 60% 50% / 0.32)` } : undefined}
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `hsl(${habit.hue} 80% 50% / ${done ? 0.28 : 0.14})`, opacity: done ? 0.7 : undefined }}
      />

      <div className="relative flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-500"
          style={{
            borderColor: done ? `hsl(${habit.hue} 60% 55% / 0.4)` : "var(--hair)",
            background: done ? `hsl(${habit.hue} 70% 50% / 0.14)` : "var(--panel-strong)",
            color: done ? accent : "var(--ink-2)",
          }}
        >
          <Icon name={habit.icon} className="h-[19px] w-[19px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="kicker">{String(habit.index).padStart(2, "0")}</span>
            {miss === "danger" && !done ? <Chip tone="bad">Missed twice</Chip> : null}
            {miss === "missed-once" && !done ? <Chip tone="warn">Recovery day</Chip> : null}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold leading-tight tracking-tight">{habit.name}</h3>
          {!compact ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-3)]">{habit.principle}</p>
          ) : null}
        </div>

        <button
          onClick={toggle}
          aria-label={done ? `Mark ${habit.name} not done` : `Complete ${habit.name}`}
          aria-pressed={done}
          className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300 active:scale-90"
          style={{
            borderColor: done ? "transparent" : "var(--hair-strong)",
            background: done ? accent : "transparent",
            color: done ? "#05070a" : "var(--ink-4)",
          }}
        >
          <Icon name="Check" className={cn("h-4 w-4 transition-transform", done ? "scale-100" : "scale-75")} strokeWidth={3} />
          {done ? (
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ border: `1px solid ${accent}`, animation: "life-pulse-ring 1.4s ease-out 1" }}
            />
          ) : null}
        </button>
      </div>

      {!compact ? (
        <>
          <div className="relative grid grid-cols-3 gap-3">
            {[
              { k: "Streak", v: `${s}`, suffix: s === 1 ? "day" : "days" },
              { k: "7 days", v: `${week}%` },
              { k: "30 days", v: `${month}%` },
            ].map((cell) => (
              <div key={cell.k}>
                <div className="kicker">{cell.k}</div>
                <div className="num mt-1 text-[19px]">
                  {cell.v}
                  {cell.suffix ? <span className="ml-1 text-[11px] text-[var(--ink-4)]">{cell.suffix}</span> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            <Bar value={week} tone={`linear-gradient(90deg, hsl(${habit.hue} 70% 45% / 0.5), ${accent})`} />
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--ink-4)]">
              <span>
                {last ? `Last: ${daysBetween(last, today) === 0 ? "today" : `${daysBetween(last, today)}d ago`}` : "Never completed"}
              </span>
              <span
                className="inline-flex items-center gap-1"
                style={{ color: trend > 0 ? "var(--good)" : trend < 0 ? "var(--bad)" : undefined }}
              >
                <Icon
                  name={trend > 0 ? "TrendingUp" : trend < 0 ? "TrendingDown" : "Minus"}
                  className="h-3 w-3"
                  strokeWidth={2}
                />
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
            </div>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Next action
 * ------------------------------------------------------------------ */

export function NextActionPanel() {
  const { state, today, completeMorningStep, togglePriority, toggleHabit, notify } = useLife();
  const now = useNow(15_000);
  const router = useRouter();
  const na = nextAction(state, now);
  const item = na.item;

  const start = () => {
    if (!item) return router.push("/life/habits");
    if (item.id.startsWith("morning:")) {
      router.push("/life/morning");
    } else if (item.id.startsWith("priority:")) {
      router.push("/life/tasks");
    } else if (item.id.startsWith("night:") || item.id === "bed") {
      router.push("/life/night");
    } else {
      router.push(item.href);
    }
  };

  const complete = () => {
    if (!item) return;
    if (item.id.startsWith("morning:")) completeMorningStep(item.id.split(":")[1]);
    else if (item.id.startsWith("priority:")) togglePriority(Number(item.id.split(":")[1]));
    else if (item.habit) toggleHabit(item.habit);
    notify({ title: `${item.label} done`, tone: "success", xp: 20 });
  };

  return (
    <Panel className="relative overflow-hidden p-6 sm:p-8">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "var(--accent-glow)", opacity: 0.5 }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span className="kicker">What should I do right now?</span>
          <Chip tone="accent">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            Live
          </Chip>
        </div>

        {item ? (
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <div className="kicker" style={{ color: "var(--accent)" }}>
                    Now · {item.time}
                  </div>
                  <h2 className="display mt-1 text-[26px] leading-tight sm:text-[32px]">{item.label}</h2>
                </div>
              </div>
              <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-[var(--ink-3)]">{na.because}</p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right">
                <div className="kicker">{na.remaining >= 0 ? "Remaining" : "Overdue"}</div>
                <div className="num mt-1 text-[28px]" style={{ color: na.remaining < 0 ? "var(--warn)" : undefined }}>
                  {Math.abs(Math.round(na.remaining))}
                  <span className="ml-1 text-[13px] text-[var(--ink-4)]">min</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Btn variant="accent" size="lg" icon="Play" onClick={start}>
                  {na.cta}
                </Btn>
                <Btn size="sm" variant="ghost" icon="Check" onClick={complete}>
                  Mark done
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="display text-[26px] leading-tight sm:text-[32px]">Nothing is owed.</h2>
              <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-[var(--ink-3)]">{na.because}</p>
            </div>
            <Btn size="lg" icon="MoonStar" onClick={() => router.push("/life/night")}>
              {na.cta}
            </Btn>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Timeline rail
 * ------------------------------------------------------------------ */

export function TimelineRail({ limit, className }: { limit?: number; className?: string }) {
  const { state } = useLife();
  const now = useNow(30_000);
  const all = buildTimeline(state, now);
  const focusIndex = Math.max(0, all.findIndex((i) => i.state === "now"));
  const items = limit ? all.slice(Math.max(0, focusIndex - 1), Math.max(0, focusIndex - 1) + limit) : all;

  return (
    <ol className={cn("relative space-y-1", className)}>
      <span className="absolute bottom-3 left-[13px] top-3 w-px bg-[var(--hair)]" aria-hidden />
      {items.map((item) => (
        <TimelineRow key={item.id} item={item} />
      ))}
    </ol>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const tone =
    item.state === "done"
      ? "var(--accent)"
      : item.state === "now"
        ? "var(--accent)"
        : item.state === "missed"
          ? "var(--bad)"
          : "var(--ink-4)";

  return (
    <li className="relative flex items-center gap-3.5 rounded-xl px-1 py-2 transition-colors hover:bg-[var(--panel)]">
      <span
        className="relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border"
        style={{
          borderColor: item.state === "upcoming" ? "var(--hair)" : tone,
          background: item.state === "done" ? tone : "var(--bg)",
          color: item.state === "done" ? "#05070a" : tone,
        }}
      >
        {item.state === "done" ? (
          <Icon name="Check" className="h-3.5 w-3.5" strokeWidth={3} />
        ) : item.state === "now" ? (
          <>
            <span className="absolute inset-0 rounded-full" style={{ border: `1px solid ${tone}`, animation: "life-pulse-ring 2s ease-out infinite" }} />
            <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
          </>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-4)" }} />
        )}
      </span>

      <Link href={item.href} className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[13.5px] tracking-tight",
            item.state === "now" ? "font-semibold" : item.state === "done" ? "text-[var(--ink-3)] line-through decoration-[var(--ink-4)]" : "",
          )}
        >
          {item.label}
        </div>
        {item.state === "now" ? (
          <div className="truncate text-[11.5px] text-[var(--ink-3)]">{item.detail}</div>
        ) : null}
      </Link>

      <span className="num shrink-0 text-[12px] text-[var(--ink-4)]">{item.time}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Recovery / never miss twice
 * ------------------------------------------------------------------ */

export function RecoveryBanner() {
  const { state, today, toggleHabit, notify } = useLife();
  const router = useRouter();
  const rec = recovery(state, today);
  if (!rec) return null;

  const habit = HABIT_BY_ID[rec.habitId];
  const danger = rec.status === "danger";

  return (
    <Panel
      className="relative overflow-hidden p-5 sm:p-6"
      style={{ borderColor: danger ? "color-mix(in srgb, var(--bad) 40%, transparent)" : "color-mix(in srgb, var(--warn) 34%, transparent)" }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: danger ? "color-mix(in srgb, var(--bad) 22%, transparent)" : "color-mix(in srgb, var(--warn) 18%, transparent)" }}
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon
              name={danger ? "Flame" : "Info"}
              className="h-4 w-4"
              style={{ color: danger ? "var(--bad)" : "var(--warn)" }}
            />
            <span className="kicker" style={{ color: danger ? "var(--bad)" : "var(--warn)" }}>
              {danger ? "Warning — missed twice" : "Missed once"}
            </span>
          </div>
          <h3 className="display mt-2 text-xl leading-tight">
            {danger ? "Don't let a slip become a slide." : "Tomorrow is your recovery day."}
          </h3>
          <p className="mt-1.5 text-[13px] text-[var(--ink-3)]">
            <span className="font-medium text-[var(--ink-2)]">{habit.name}</span> — {rec.action}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Btn
            variant="accent"
            icon="Play"
            onClick={() => {
              router.push(rec.href);
            }}
          >
            Start recovery · {rec.minutes} min
          </Btn>
          <Btn
            variant="ghost"
            icon="Check"
            onClick={() => {
              toggleHabit(rec.habitId);
              notify({ title: "Recovered", body: `${habit.name} is back on track.`, tone: "success", xp: 20 });
            }}
          >
            Done
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Priority card
 * ------------------------------------------------------------------ */

export function PriorityCard({ index }: { index: 0 | 1 }) {
  const { state, today, setPriority, togglePriority, notify } = useLife();
  const day = getDay(state, today);
  const priority = day.priorities[index];
  const done = Boolean(priority?.done);

  return (
    <Panel
      className="group relative flex items-center gap-4 overflow-hidden p-5"
      style={done ? { borderColor: "var(--accent-line)" } : undefined}
    >
      {done ? (
        <div className="pointer-events-none absolute inset-0" style={{ background: "var(--accent-soft)", opacity: 0.35 }} />
      ) : null}
      <button
        onClick={() => {
          if (!priority?.title) return;
          togglePriority(index);
          if (!done) notify({ title: `Priority #${index + 1} closed`, body: priority.title, tone: "success", xp: 30 });
        }}
        aria-label={`Toggle priority ${index + 1}`}
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all duration-300 active:scale-90"
        style={{
          borderColor: done ? "transparent" : "var(--hair-strong)",
          background: done ? "var(--accent)" : "transparent",
          color: done ? "hsl(var(--a-h) 60% 8%)" : "var(--ink-4)",
        }}
      >
        {done ? (
          <Icon name="Check" className="h-5 w-5" strokeWidth={3} />
        ) : (
          <span className="num text-[15px]">{index + 1}</span>
        )}
      </button>

      <div className="relative min-w-0 flex-1">
        <div className="kicker">Priority #{index + 1}</div>
        <input
          value={priority?.title ?? ""}
          onChange={(e) => setPriority(index, e.target.value)}
          placeholder={index === 0 ? "The one thing that must happen" : "The second lever"}
          className={cn(
            "mt-1 w-full bg-transparent text-[15.5px] font-medium tracking-tight outline-none placeholder:font-normal placeholder:text-[var(--ink-4)]",
            done && "text-[var(--ink-3)] line-through decoration-[var(--ink-4)]",
          )}
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function DemoBadge() {
  const { state } = useLife();
  const hasSeed = Object.values(state.days).some((d) => d.seeded);
  if (!hasSeed || !state.settings.showDemoHistory) return null;
  return (
    <Link href="/life/settings" className="chip" title="Analytics include the generated 90-day demo history">
      <Icon name="Info" className="h-3 w-3" />
      Demo history on
    </Link>
  );
}

export function HabitStrip() {
  const { state, today } = useLife();
  const day = getDay(state, today);
  return (
    <div className="flex flex-wrap gap-2">
      {HABITS.map((h) => {
        const done = Boolean(day.habits[h.id]);
        return (
          <Link
            key={h.id}
            href="/life/habits"
            title={`${h.name} — ${done ? "complete" : "open"}`}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition"
            style={{
              borderColor: done ? `hsl(${h.hue} 60% 55% / 0.4)` : "var(--hair)",
              background: done ? `hsl(${h.hue} 70% 50% / 0.12)` : "var(--panel)",
              color: done ? `hsl(${h.hue} 78% 62%)` : "var(--ink-3)",
            }}
          >
            <Icon name={h.icon} className="h-3.5 w-3.5" />
            {h.name}
          </Link>
        );
      })}
    </div>
  );
}

export function ScoreSpark({ days = 14 }: { days?: number }) {
  const { state, today } = useLife();
  const points = lastNDays(days, today).map((k) => dailyScore(getDay(state, k)));
  return <Spark points={points} width={140} height={38} />;
}

export function MiniStat({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <Panel hover className="h-full p-5">
        <div className="flex items-center justify-between">
          <span className="kicker">{label}</span>
          <Icon name={icon} className="h-4 w-4 text-[var(--ink-4)]" />
        </div>
        <div className="num mt-3 text-[26px] leading-none">{value}</div>
        {sub ? <div className="mt-2 text-[12px] text-[var(--ink-3)]">{sub}</div> : null}
      </Panel>
    </Link>
  );
}
