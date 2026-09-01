import {
  addDays,
  clockDelta,
  clockToMinutes,
  dateKey,
  daysBetween,
  lastNDays,
  minutesNow,
  minutesToClock,
} from "./date";
import { HABITS, HABIT_BY_ID, MORNING_STEPS, NIGHT_STEPS } from "./habits";
import type {
  DayRecord,
  HabitId,
  ISODate,
  LifeState,
  Settings,
} from "./types";

/* ------------------------------------------------------------------ *
 * Day access
 * ------------------------------------------------------------------ */

export function emptyDay(date: ISODate, settings?: Settings): DayRecord {
  return {
    date,
    habits: {},
    morning: {},
    priorities: [],
    wakeTarget: settings?.wakeTime,
    bedTarget: settings?.bedTime,
    xp: 0,
  };
}

export function getDay(state: LifeState, date: ISODate): DayRecord {
  return state.days[date] ?? emptyDay(date, state.settings);
}

/** Day rows the analytics should consider, honouring the demo-history toggle. */
export function visibleDays(state: LifeState): Record<ISODate, DayRecord> {
  if (state.settings.showDemoHistory) return state.days;
  const out: Record<ISODate, DayRecord> = {};
  for (const [k, v] of Object.entries(state.days)) if (!v.seeded) out[k] = v;
  return out;
}

function day(state: LifeState, date: ISODate): DayRecord | undefined {
  const d = state.days[date];
  if (!d) return undefined;
  if (d.seeded && !state.settings.showDemoHistory) return undefined;
  return d;
}

/* ------------------------------------------------------------------ *
 * Scores
 * ------------------------------------------------------------------ */

export function habitsDone(d: DayRecord): number {
  return HABITS.reduce((n, h) => n + (d.habits[h.id] ? 1 : 0), 0);
}

/** 0–100. The daily score is habit completion, full stop — it stays honest. */
export function dailyScore(d: DayRecord): number {
  return Math.round((habitsDone(d) / HABITS.length) * 100);
}

export const XP = {
  habit: 20,
  priority: 30,
  journal: 15,
  learning: 15,
  debrief: 20,
  onTimeWake: 25,
  onTimeBed: 25,
  milestone: 100,
} as const;

export function dayXp(d: DayRecord): number {
  let xp = habitsDone(d) * XP.habit;
  xp += d.priorities.filter((p) => p.done).length * XP.priority;
  if (d.journal?.completedAt) xp += XP.journal;
  if (d.learning?.completedAt) xp += XP.learning;
  if (d.debrief?.completedAt) xp += XP.debrief;
  if (d.wakeActual && d.wakeTarget && clockDelta(d.wakeTarget, d.wakeActual) <= 10) xp += XP.onTimeWake;
  if (d.bedActual && d.bedTarget && clockDelta(d.bedTarget, d.bedActual) <= 15) xp += XP.onTimeBed;
  xp += (d.milestones?.length ?? 0) * XP.milestone;
  return xp;
}

export function totalXp(state: LifeState): number {
  return Object.values(visibleDays(state)).reduce((n, d) => n + dayXp(d), 0);
}

/** Levels get progressively more expensive: 1000, 2400, 4200, … */
export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  let span = 1000;
  let remaining = xp;
  while (remaining >= span) {
    remaining -= span;
    level += 1;
    span = Math.round(span * 1.4);
  }
  return { level, into: remaining, span };
}

/* ------------------------------------------------------------------ *
 * Streaks & consistency
 * ------------------------------------------------------------------ */

/**
 * Consecutive completed days ending today. Today not being done yet does not
 * break the streak — the day isn't over. Yesterday not being done does.
 */
export function streak(state: LifeState, habitId: HabitId, end: ISODate = dateKey()): number {
  let n = 0;
  let cursor = end;
  if (!day(state, cursor)?.habits[habitId]) cursor = addDays(cursor, -1);
  else {
    n = 1;
    cursor = addDays(cursor, -1);
  }
  while (day(state, cursor)?.habits[habitId]) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function longestStreak(state: LifeState, habitId: HabitId): number {
  const keys = Object.keys(visibleDays(state)).sort();
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const k of keys) {
    const done = state.days[k].habits[habitId];
    if (!done) {
      run = 0;
      prev = k;
      continue;
    }
    run = prev && daysBetween(prev, k) === 1 && state.days[prev].habits[habitId] ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Percentage of the last `n` days (that exist in the log) the habit was done. */
export function completion(state: LifeState, habitId: HabitId, n: number, end: ISODate = dateKey()): number {
  const keys = lastNDays(n, end);
  const known = keys.map((k) => day(state, k)).filter(Boolean) as DayRecord[];
  if (!known.length) return 0;
  const done = known.filter((d) => d.habits[habitId]).length;
  return Math.round((done / known.length) * 100);
}

export function lastCompleted(state: LifeState, habitId: HabitId): ISODate | null {
  const keys = Object.keys(visibleDays(state)).sort().reverse();
  for (const k of keys) if (state.days[k].habits[habitId]) return k;
  return null;
}

/** −100…+100. Last 7 days against the 7 before them. */
export function habitTrend(state: LifeState, habitId: HabitId, end: ISODate = dateKey()): number {
  const recent = completion(state, habitId, 7, end);
  const prior = completion(state, habitId, 7, addDays(end, -7));
  return recent - prior;
}

export type MissStatus = "clean" | "missed-once" | "danger";

/**
 * The never-miss-twice rule. Only closed days count — today being incomplete is
 * not a miss until the day is over.
 */
export function missStatus(state: LifeState, habitId: HabitId, today: ISODate = dateKey()): MissStatus {
  const y = day(state, addDays(today, -1));
  const yy = day(state, addDays(today, -2));
  const missedY = y ? !y.habits[habitId] : false;
  const missedYY = yy ? !yy.habits[habitId] : false;
  if (missedY && missedYY) return "danger";
  if (missedY) return "missed-once";
  return "clean";
}

/* ------------------------------------------------------------------ *
 * Momentum
 * ------------------------------------------------------------------ */

/** Fraction of the *active* day elapsed, so a 07:00 momentum read isn't punished. */
export function dayProgress(settings: Settings, at: Date = new Date()): number {
  const start = clockToMinutes(settings.wakeTime);
  let end = clockToMinutes(settings.bedTime);
  if (end <= start) end += 1440;
  const now = minutesNow(at);
  return Math.min(1, Math.max(0.05, (now - start) / (end - start)));
}

export interface MomentumBreakdown {
  score: number;
  consistency: number;
  trend: number;
  rhythm: number;
  direction: "building" | "stable" | "slipping";
  delta: number;
}

/**
 * Momentum, 0–100. Four inputs:
 *   consistency — recency-weighted habit completion over 7 days
 *   trend       — last 3 days against the 4 before them
 *   rhythm      — how close wake and bed times land to their targets
 *   today       — the current day, weighted by how much of it has passed
 */
export function momentum(state: LifeState, at: ISODate = dateKey(), now: Date = new Date()): MomentumBreakdown {
  const isToday = at === dateKey();
  const window = lastNDays(7, at);

  let weighted = 0;
  let weight = 0;
  window.forEach((k, i) => {
    const d = day(state, k);
    if (!d) return;
    const recency = 0.55 + (i / 6) * 0.45;
    let score = dailyScore(d);
    if (k === at && isToday) {
      // The day is still running: judge it against what could plausibly be done by now.
      const p = dayProgress(state.settings, now);
      score = Math.min(100, score / Math.max(0.3, p));
    }
    weighted += score * recency;
    weight += recency;
  });
  const consistency = weight ? weighted / weight : 0;

  const recent = avgScore(state, lastNDays(3, at));
  const prior = avgScore(state, lastNDays(4, addDays(at, -3)));
  const rawTrend = recent - prior;
  const trend = clamp(50 + rawTrend * 2.2, 0, 100);

  const rhythm = rhythmScore(state, at);

  const score = Math.round(clamp(consistency * 0.62 + trend * 0.2 + rhythm * 0.18, 0, 100));

  const delta = Math.round(score - momentumSimple(state, addDays(at, -1)));

  return {
    score,
    consistency: Math.round(consistency),
    trend: Math.round(trend),
    rhythm: Math.round(rhythm),
    direction: delta > 2 ? "building" : delta < -2 ? "slipping" : "stable",
    delta,
  };
}

/** Closed-day momentum, used for history and for the day-over-day delta. */
function momentumSimple(state: LifeState, at: ISODate): number {
  const window = lastNDays(7, at);
  let weighted = 0;
  let weight = 0;
  window.forEach((k, i) => {
    const d = day(state, k);
    if (!d) return;
    const recency = 0.55 + (i / 6) * 0.45;
    weighted += dailyScore(d) * recency;
    weight += recency;
  });
  const consistency = weight ? weighted / weight : 0;
  const recent = avgScore(state, lastNDays(3, at));
  const prior = avgScore(state, lastNDays(4, addDays(at, -3)));
  const trend = clamp(50 + (recent - prior) * 2.2, 0, 100);
  return Math.round(clamp(consistency * 0.62 + trend * 0.2 + rhythmScore(state, at) * 0.18, 0, 100));
}

export function momentumSeries(state: LifeState, n = 30, end: ISODate = dateKey()): { date: ISODate; value: number }[] {
  return lastNDays(n, end).map((k) => ({
    date: k,
    value: k === dateKey() ? momentum(state, k).score : momentumSimple(state, k),
  }));
}

function avgScore(state: LifeState, keys: ISODate[]): number {
  const known = keys.map((k) => day(state, k)).filter(Boolean) as DayRecord[];
  if (!known.length) return 0;
  return known.reduce((n, d) => n + dailyScore(d), 0) / known.length;
}

/** How tightly wake and bed times hit their targets over the last 7 days. */
export function rhythmScore(state: LifeState, at: ISODate = dateKey()): number {
  const keys = lastNDays(7, at);
  const samples: number[] = [];
  for (const k of keys) {
    const d = day(state, k);
    if (!d) continue;
    if (d.wakeActual && d.wakeTarget) samples.push(punctuality(clockDelta(d.wakeTarget, d.wakeActual), 45));
    if (d.bedActual && d.bedTarget) samples.push(punctuality(clockDelta(d.bedTarget, d.bedActual), 60));
  }
  if (!samples.length) return 50;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

/** Early is fine, late decays linearly to zero at `tolerance` minutes. */
function punctuality(deltaMins: number, tolerance: number): number {
  if (deltaMins <= 0) return 100;
  return clamp(100 - (deltaMins / tolerance) * 100, 0, 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------ *
 * Rhythm analytics
 * ------------------------------------------------------------------ */

export interface Consistency {
  /** Percentage of logged days within tolerance. */
  rate: number;
  /** Average signed minutes off target. */
  avgDelta: number;
  samples: number;
}

export function wakeConsistency(state: LifeState, n = 7, end: ISODate = dateKey()): Consistency {
  return punctualitySeries(state, n, end, "wake", 10);
}

export function bedConsistency(state: LifeState, n = 7, end: ISODate = dateKey()): Consistency {
  return punctualitySeries(state, n, end, "bed", 15);
}

function punctualitySeries(
  state: LifeState,
  n: number,
  end: ISODate,
  kind: "wake" | "bed",
  tolerance: number,
): Consistency {
  const deltas: number[] = [];
  for (const k of lastNDays(n, end)) {
    const d = day(state, k);
    if (!d) continue;
    const target = kind === "wake" ? d.wakeTarget : d.bedTarget;
    const actual = kind === "wake" ? d.wakeActual : d.bedActual;
    if (target && actual) deltas.push(clockDelta(target, actual));
  }
  if (!deltas.length) return { rate: 0, avgDelta: 0, samples: 0 };
  const onTime = deltas.filter((d) => d <= tolerance).length;
  return {
    rate: Math.round((onTime / deltas.length) * 100),
    avgDelta: Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length),
    samples: deltas.length,
  };
}

/* ------------------------------------------------------------------ *
 * North Star
 * ------------------------------------------------------------------ */

export function northStarSeries(state: LifeState, n = 30, end: ISODate = dateKey()) {
  return lastNDays(n, end)
    .map((k) => ({ date: k, value: day(state, k)?.northStar }))
    .filter((p): p is { date: ISODate; value: number } => typeof p.value === "number");
}

export function northStarLatest(state: LifeState): { date: ISODate; value: number } | null {
  const series = northStarSeries(state, 120);
  return series.length ? series[series.length - 1] : null;
}

export function northStarChange(state: LifeState, n: number): number | null {
  const series = northStarSeries(state, n * 2);
  if (series.length < 2) return null;
  const cutoff = addDays(dateKey(), -n);
  const before = series.filter((p) => p.date <= cutoff).pop();
  const now = series[series.length - 1];
  if (!before || !before.value) return null;
  return ((now.value - before.value) / Math.abs(before.value)) * 100;
}

/* ------------------------------------------------------------------ *
 * The day's timeline & the Next Action engine
 * ------------------------------------------------------------------ */

export type TimelineState = "done" | "now" | "next" | "upcoming" | "missed";

export interface TimelineItem {
  id: string;
  label: string;
  detail: string;
  time: string;
  startMin: number;
  endMin: number;
  icon: string;
  habit?: HabitId;
  href: string;
  state: TimelineState;
  done: boolean;
}

/**
 * The whole day as a single ordered list, built from the user's own wake and bed
 * times. Everything downstream — the Next Action engine, the morning ring, the
 * routine rail — reads this one structure.
 */
export function buildTimeline(state: LifeState, now: Date = new Date()): TimelineItem[] {
  const today = dateKey(now);
  const d = getDay(state, today);
  const wake = clockToMinutes(d.wakeTarget ?? state.settings.wakeTime);
  const bed = clockToMinutes(d.bedTarget ?? state.settings.bedTime);
  const current = minutesNow(now);

  const raw: Omit<TimelineItem, "state">[] = [];

  for (const step of MORNING_STEPS) {
    const start = wake + step.offset;
    raw.push({
      id: `morning:${step.id}`,
      label: step.label,
      detail: step.detail,
      time: minutesToClock(start),
      startMin: start,
      endMin: start + step.minutes,
      icon: step.icon,
      habit: step.habit,
      href: step.habit ? HABIT_BY_ID[step.habit].href : "/life/morning",
      done: Boolean(d.morning[step.id]) || (step.id === "wake" && Boolean(d.wakeActual)),
    });
  }

  const p1 = d.priorities[0];
  const p2 = d.priorities[1];
  const afterMorning = wake + state.settings.protectedMinutes;
  raw.push({
    id: "priority:0",
    label: p1?.title ? `Priority #1 — ${p1.title}` : "Priority #1",
    detail: "Deep work on the thing that actually matters.",
    time: minutesToClock(afterMorning),
    startMin: afterMorning,
    endMin: afterMorning + 90,
    icon: "Flag",
    href: "/life/tasks",
    done: Boolean(p1?.done),
  });
  raw.push({
    id: "priority:1",
    label: p2?.title ? `Priority #2 — ${p2.title}` : "Priority #2",
    detail: "The second lever of the day.",
    time: minutesToClock(afterMorning + 180),
    startMin: afterMorning + 180,
    endMin: afterMorning + 270,
    icon: "Flag",
    href: "/life/tasks",
    done: Boolean(p2?.done),
  });
  raw.push({
    id: "habit:choose-hard",
    label: "Choose hard",
    detail: "Today's deliberately uncomfortable action.",
    time: minutesToClock(afterMorning + 300),
    startMin: afterMorning + 300,
    endMin: afterMorning + 345,
    icon: "Mountain",
    habit: "choose-hard",
    href: "/life/choose-hard",
    done: Boolean(d.habits["choose-hard"]),
  });
  raw.push({
    id: "habit:measure",
    label: "Log the North Star",
    detail: `Record today's ${state.northStar.label.toLowerCase()}.`,
    time: minutesToClock(bed - 180),
    startMin: bed - 180,
    endMin: bed - 150,
    icon: "Target",
    habit: "measure",
    href: "/life/north-star",
    done: typeof d.northStar === "number",
  });

  for (const step of NIGHT_STEPS) {
    const start = bed - step.offset;
    raw.push({
      id: `night:${step.id}`,
      label: step.label,
      detail: step.detail,
      time: minutesToClock(start),
      startMin: start,
      endMin: start + step.minutes,
      icon: step.icon,
      habit: step.habit,
      href: "/life/night",
      done: nightStepDone(step.id, d),
    });
  }

  raw.push({
    id: "bed",
    label: "Lights out",
    detail: "Tomorrow starts tonight.",
    time: minutesToClock(bed),
    startMin: bed,
    endMin: bed + 10,
    icon: "MoonStar",
    href: "/life/night",
    done: Boolean(d.bedActual),
  });

  raw.sort((a, b) => a.startMin - b.startMin);

  const firstOpen = raw.find((i) => !i.done && current < i.endMin + 240);
  const activeNow = raw.find((i) => !i.done && current >= i.startMin && current < i.endMin);
  const focus = activeNow ?? firstOpen;

  return raw.map((item) => {
    let itemState: TimelineState = "upcoming";
    if (item.done) itemState = "done";
    else if (focus && item.id === focus.id) itemState = "now";
    else if (current > item.endMin + 240) itemState = "missed";
    else if (current > item.endMin) itemState = "missed";
    else if (focus && item.startMin > focus.startMin) itemState = "next";
    return { ...item, state: itemState };
  });
}

export interface NextAction {
  item: TimelineItem | null;
  /** Minutes left in the window, negative when running late. */
  remaining: number;
  /** Why this action, in one line. */
  because: string;
  cta: string;
}

export function nextAction(state: LifeState, now: Date = new Date()): NextAction {
  const timeline = buildTimeline(state, now);
  const item = timeline.find((i) => i.state === "now") ?? null;
  const current = minutesNow(now);
  const today = getDay(state, dateKey(now));

  if (!item) {
    const allDone = habitsDone(today) === HABITS.length;
    return {
      item: null,
      remaining: 0,
      because: allDone
        ? "Every habit is closed. The day is yours."
        : "Nothing is scheduled right now — the day is clear.",
      cta: allDone ? "Review the day" : "Open the day",
    };
  }

  const remaining = item.endMin - current;
  let because = "Next in your routine.";
  if (item.id.startsWith("morning:")) because = "Your morning is protected — this comes before the world.";
  else if (item.id.startsWith("priority:")) because = "Two priorities decide the day. This is one of them.";
  else if (item.id.startsWith("night:")) because = "Tomorrow is won tonight.";
  else if (item.habit === "measure") because = "One number, logged daily. Today's is still blank.";
  else if (item.habit === "choose-hard") because = "The uncomfortable choice is still open.";

  return {
    item,
    remaining,
    because,
    cta: remaining < 0 ? "Do it now" : "Start",
  };
}

function nightStepDone(id: string, d: DayRecord): boolean {
  switch (id) {
    case "debrief":
      return Boolean(d.debrief?.completedAt);
    case "tomorrow":
      return Boolean(d.habits["win-tomorrow"]);
    case "prepare":
      return Boolean(d.habits.environment);
    default:
      return Boolean(d.morning[`night:${id}`]);
  }
}

/* ------------------------------------------------------------------ *
 * Protected morning
 * ------------------------------------------------------------------ */

export interface ProtectedMorning {
  active: boolean;
  /** Seconds left in the protected window. */
  remaining: number;
  total: number;
  progress: number;
}

export function protectedMorning(state: LifeState, now: Date = new Date()): ProtectedMorning {
  const d = getDay(state, dateKey(now));
  const total = state.settings.protectedMinutes * 60;
  const startClock = d.wakeActual ?? d.wakeTarget ?? state.settings.wakeTime;
  const start = clockToMinutes(startClock);
  const started = Boolean(d.wakeActual);
  const elapsed = (minutesNow(now) - start) * 60;
  const remaining = total - elapsed;
  return {
    active: started && remaining > 0 && elapsed >= 0,
    remaining: Math.max(0, remaining),
    total,
    // The window only has progress once it has actually begun.
    progress: started ? clamp(elapsed / total, 0, 1) : 0,
  };
}

export function morningProgress(state: LifeState, date: ISODate = dateKey()): number {
  const d = getDay(state, date);
  const done = MORNING_STEPS.filter((s) => d.morning[s.id] || (s.id === "wake" && d.wakeActual)).length;
  return Math.round((done / MORNING_STEPS.length) * 100);
}

/* ------------------------------------------------------------------ *
 * Challenge
 * ------------------------------------------------------------------ */

export function challengeProgress(state: LifeState, today: ISODate = dateKey()) {
  const { challenge } = state;
  const total = Math.max(1, daysBetween(challenge.startDate, challenge.endDate));
  const elapsed = clamp(daysBetween(challenge.startDate, today), 0, total);
  const daysRemaining = Math.max(0, daysBetween(today, challenge.endDate));
  const doneMilestones = challenge.milestones.filter((m) => m.done).length;
  const byMilestone = challenge.milestones.length
    ? doneMilestones / challenge.milestones.length
    : elapsed / total;
  return {
    total,
    elapsed,
    daysRemaining,
    doneMilestones,
    milestoneCount: challenge.milestones.length,
    /** Progress is milestone-led, time is only the backdrop. */
    progress: Math.round(byMilestone * 100),
    timeProgress: Math.round((elapsed / total) * 100),
    /** Positive when ahead of the calendar. */
    pace: Math.round((byMilestone - elapsed / total) * 100),
    complete: challenge.milestones.length > 0 && doneMilestones === challenge.milestones.length,
  };
}

/* ------------------------------------------------------------------ *
 * Learning
 * ------------------------------------------------------------------ */

export function pagesRead(state: LifeState): number {
  return Object.values(visibleDays(state))
    .filter((d) => d.date >= state.book.startedOn)
    .reduce((n, d) => n + (d.learning?.pages ?? 0), 0);
}

export function learningStreak(state: LifeState): number {
  return streak(state, "learn");
}

/* ------------------------------------------------------------------ *
 * Recovery — the never-miss-twice engine
 * ------------------------------------------------------------------ */

export interface Recovery {
  habitId: HabitId;
  status: MissStatus;
  action: string;
  minutes: number;
  href: string;
}

const RECOVERY_ACTIONS: Record<HabitId, { action: string; minutes: number }> = {
  "win-tomorrow": { action: "Write tomorrow's two priorities. Nothing else.", minutes: 3 },
  "protect-morning": { action: "Put the phone in another room and set tomorrow's alarm now.", minutes: 2 },
  journal: { action: "Two-minute brain dump. Whatever is loudest in your head.", minutes: 2 },
  learn: { action: "Read two pages. Not ten. Two.", minutes: 5 },
  environment: { action: "Clear one surface. Make tomorrow's first action obvious.", minutes: 5 },
  measure: { action: "Log today's North Star number, even if it's zero.", minutes: 1 },
  momentum: { action: "Five-minute workout. Right now, where you are.", minutes: 5 },
  "choose-hard": { action: "Do the smallest hard thing on your list. Cold water counts.", minutes: 5 },
};

/** The single most valuable recovery move available right now. */
export function recovery(state: LifeState, today: ISODate = dateKey()): Recovery | null {
  const ranked = HABITS.map((h) => ({ h, status: missStatus(state, h.id, today) }))
    .filter((r) => r.status !== "clean" && !getDay(state, today).habits[r.h.id])
    .sort((a, b) => (a.status === "danger" ? -1 : 1) - (b.status === "danger" ? -1 : 1));
  const top = ranked[0];
  if (!top) return null;
  return {
    habitId: top.h.id,
    status: top.status,
    ...RECOVERY_ACTIONS[top.h.id],
    href: top.h.href,
  };
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

export interface PeriodReport {
  keys: ISODate[];
  loggedDays: number;
  habitsCompleted: number;
  possible: number;
  avgScore: number;
  perfectDays: number;
  bestDay: { date: ISODate; score: number } | null;
  weakestDay: { date: ISODate; score: number } | null;
  strongestHabit: { id: HabitId; rate: number } | null;
  weakestHabit: { id: HabitId; rate: number } | null;
  wake: Consistency;
  bed: Consistency;
  learningSessions: number;
  pages: number;
  prioritiesDone: number;
  prioritiesSet: number;
  momentumStart: number;
  momentumEnd: number;
  northStarStart: number | null;
  northStarEnd: number | null;
  xp: number;
}

export function report(state: LifeState, keys: ISODate[]): PeriodReport {
  const rows = keys.map((k) => day(state, k)).filter(Boolean) as DayRecord[];
  const scores = rows.map((d) => ({ date: d.date, score: dailyScore(d) }));
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  const rates = HABITS.map((h) => {
    const done = rows.filter((d) => d.habits[h.id]).length;
    return { id: h.id, rate: rows.length ? Math.round((done / rows.length) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate);

  const nsRows = rows.filter((d) => typeof d.northStar === "number");
  const end = keys[keys.length - 1];
  const start = keys[0];

  return {
    keys,
    loggedDays: rows.length,
    habitsCompleted: rows.reduce((n, d) => n + habitsDone(d), 0),
    possible: rows.length * HABITS.length,
    avgScore: rows.length ? Math.round(scores.reduce((n, s) => n + s.score, 0) / rows.length) : 0,
    perfectDays: scores.filter((s) => s.score === 100).length,
    bestDay: sorted[0] ?? null,
    weakestDay: sorted.length ? sorted[sorted.length - 1] : null,
    strongestHabit: rates[0] ?? null,
    weakestHabit: rates.length ? rates[rates.length - 1] : null,
    wake: punctualitySeries(state, keys.length, end, "wake", 10),
    bed: punctualitySeries(state, keys.length, end, "bed", 15),
    learningSessions: rows.filter((d) => d.learning?.completedAt).length,
    pages: rows.reduce((n, d) => n + (d.learning?.pages ?? 0), 0),
    prioritiesDone: rows.reduce((n, d) => n + d.priorities.filter((p) => p.done).length, 0),
    prioritiesSet: rows.reduce((n, d) => n + d.priorities.length, 0),
    momentumStart: momentumSimple(state, start),
    momentumEnd: end === dateKey() ? momentum(state, end).score : momentumSimple(state, end),
    northStarStart: nsRows.length ? (nsRows[0].northStar as number) : null,
    northStarEnd: nsRows.length ? (nsRows[nsRows.length - 1].northStar as number) : null,
    xp: rows.reduce((n, d) => n + dayXp(d), 0),
  };
}

/** Longest streak of any habit inside a set of days. */
export function bestStreakIn(state: LifeState, keys: ISODate[]): { id: HabitId; length: number } | null {
  let best: { id: HabitId; length: number } | null = null;
  for (const h of HABITS) {
    let run = 0;
    let top = 0;
    for (const k of keys) {
      const d = day(state, k);
      run = d?.habits[h.id] ? run + 1 : 0;
      top = Math.max(top, run);
    }
    if (!best || top > best.length) best = { id: h.id, length: top };
  }
  return best;
}

/**
 * Consecutive days scoring at or above `threshold` — the "momentum streak".
 * Today counts if it already qualifies, but an unfinished today never breaks it.
 */
export function momentumStreak(state: LifeState, threshold = 50, end: ISODate = dateKey()): number {
  let n = 0;
  let cursor = end;
  if (dailyScore(getDay(state, cursor)) >= threshold) n = 1;
  cursor = addDays(cursor, -1);
  while (day(state, cursor) && dailyScore(state.days[cursor]) >= threshold) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Perfect days (all eight habits) across the whole visible log. */
export function perfectDays(state: LifeState): number {
  return Object.values(visibleDays(state)).filter((d) => habitsDone(d) === HABITS.length).length;
}
