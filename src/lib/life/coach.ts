import { addDays, dateKey, formatDelta, shortDate, weekOf } from "./date";
import { HABITS, HABIT_BY_ID } from "./habits";
import {
  bedConsistency,
  challengeProgress,
  completion,
  dailyScore,
  getDay,
  habitTrend,
  habitsDone,
  learningStreak,
  missStatus,
  momentum,
  momentumSeries,
  northStarChange,
  northStarLatest,
  nextAction,
  recovery,
  report,
  streak,
  totalXp,
  wakeConsistency,
} from "./engine";
import type { HabitId, LifeState } from "./types";

/**
 * A compact, human-readable snapshot of the system. This is the only thing the
 * coach — local or model-backed — is allowed to reason from, which keeps the
 * two engines saying the same thing and keeps the payload small.
 */
export interface CoachSnapshot {
  name: string;
  mission: string;
  date: string;
  time: string;
  momentum: { score: number; delta: number; direction: string; last14: number[] };
  today: {
    score: number;
    habitsDone: number;
    habitsTotal: number;
    open: string[];
    priorities: { title: string; done: boolean }[];
    nextAction: string | null;
    nextBecause: string;
  };
  week: {
    avgScore: number;
    perfectDays: number;
    habitsCompleted: number;
    possible: number;
    wakeOnTime: number;
    wakeAvgDelta: number;
    bedOnTime: number;
    bedAvgDelta: number;
    prioritiesDone: number;
    prioritiesSet: number;
  };
  habits: {
    id: HabitId;
    name: string;
    streak: number;
    week: number;
    month: number;
    trend: number;
    missStatus: string;
    doneToday: boolean;
  }[];
  northStar: {
    label: string;
    latest: number | null;
    target: number;
    progress: number;
    change7d: number | null;
    change30d: number | null;
  };
  challenge: { title: string; progress: number; daysRemaining: number; pace: number };
  learning: { book: string; streak: number; pagesToday: number; target: number };
  recovery: { habit: string; action: string; status: string } | null;
  xp: number;
}

export function buildSnapshot(state: LifeState, now = new Date()): CoachSnapshot {
  const today = dateKey(now);
  const day = getDay(state, today);
  const m = momentum(state, today, now);
  const week = report(state, weekOf(today).filter((k) => k <= today));
  const wake = wakeConsistency(state, 7);
  const bed = bedConsistency(state, 7);
  const na = nextAction(state, now);
  const ns = northStarLatest(state);
  const ch = challengeProgress(state, today);
  const rec = recovery(state, today);

  return {
    name: state.profile.name,
    mission: state.profile.mission,
    date: today,
    time: now.toTimeString().slice(0, 5),
    momentum: {
      score: m.score,
      delta: m.delta,
      direction: m.direction,
      last14: momentumSeries(state, 14).map((p) => p.value),
    },
    today: {
      score: dailyScore(day),
      habitsDone: habitsDone(day),
      habitsTotal: HABITS.length,
      open: HABITS.filter((h) => !day.habits[h.id]).map((h) => h.name),
      priorities: day.priorities.map((p) => ({ title: p.title, done: p.done })),
      nextAction: na.item?.label ?? null,
      nextBecause: na.because,
    },
    week: {
      avgScore: week.avgScore,
      perfectDays: week.perfectDays,
      habitsCompleted: week.habitsCompleted,
      possible: week.possible,
      wakeOnTime: wake.rate,
      wakeAvgDelta: wake.avgDelta,
      bedOnTime: bed.rate,
      bedAvgDelta: bed.avgDelta,
      prioritiesDone: week.prioritiesDone,
      prioritiesSet: week.prioritiesSet,
    },
    habits: HABITS.map((h) => ({
      id: h.id,
      name: h.name,
      streak: streak(state, h.id, today),
      week: completion(state, h.id, 7, today),
      month: completion(state, h.id, 30, today),
      trend: habitTrend(state, h.id, today),
      missStatus: missStatus(state, h.id, today),
      doneToday: Boolean(day.habits[h.id]),
    })),
    northStar: {
      label: state.northStar.label,
      latest: ns?.value ?? null,
      target: state.northStar.target,
      progress: ns ? Math.round((ns.value / state.northStar.target) * 1000) / 10 : 0,
      change7d: northStarChange(state, 7),
      change30d: northStarChange(state, 30),
    },
    challenge: {
      title: state.challenge.title,
      progress: ch.progress,
      daysRemaining: ch.daysRemaining,
      pace: ch.pace,
    },
    learning: {
      book: `${state.book.title} — ${state.book.author}`,
      streak: learningStreak(state),
      pagesToday: day.learning?.pages ?? 0,
      target: state.book.dailyTarget,
    },
    recovery: rec ? { habit: HABIT_BY_ID[rec.habitId].name, action: rec.action, status: rec.status } : null,
    xp: totalXp(state),
  };
}

/* ------------------------------------------------------------------ *
 * The local coach.
 *
 * Rule-based, deterministic, and honest about being local. It reads the same
 * snapshot the model would, so the two never contradict each other.
 * ------------------------------------------------------------------ */

type Intent =
  | "now"
  | "momentum"
  | "week"
  | "tomorrow"
  | "weakest"
  | "improving"
  | "northstar"
  | "challenge"
  | "sleep"
  | "general";

function classify(q: string): Intent {
  const s = q.toLowerCase();
  if (/(right now|what should i do|next)/.test(s)) return "now";
  if (/(momentum|losing|slipping|motivat)/.test(s)) return "momentum";
  if (/(this week|weekly|perform|how did i do)/.test(s)) return "week";
  if (/(tomorrow|focus next)/.test(s)) return "tomorrow";
  if (/(holding me back|weakest|worst|struggling)/.test(s)) return "weakest";
  if (/(improving|better|progress|trend)/.test(s)) return "improving";
  if (/(north star|metric|revenue|number)/.test(s)) return "northstar";
  if (/(challenge|hard thing|mountain)/.test(s)) return "challenge";
  if (/(sleep|bed|wake|morning routine|tired)/.test(s)) return "sleep";
  return "general";
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

export function localAnswer(s: CoachSnapshot, question: string): string {
  const intent = classify(question);
  const weakest = [...s.habits].sort((a, b) => a.week - b.week)[0];
  const strongest = [...s.habits].sort((a, b) => b.week - a.week)[0];
  const openCount = s.today.open.length;

  switch (intent) {
    case "now": {
      if (s.today.nextAction) {
        return `Right now: **${s.today.nextAction}**. ${s.today.nextBecause}\n\nYou have ${openCount} habit${openCount === 1 ? "" : "s"} still open today and momentum sits at ${s.momentum.score}. Do this one thing before you touch anything else.`;
      }
      if (openCount === 0) {
        return `Nothing is owed. All eight habits are closed, the day scored ${s.today.score}%. Protect the evening and set tomorrow's two priorities — that is the only move left with leverage.`;
      }
      return `Nothing is scheduled this minute, so take the highest-leverage open habit: **${s.today.open[0]}**. It is the difference between a ${s.today.score}% day and a better one.`;
    }

    case "momentum": {
      const dir =
        s.momentum.direction === "building"
          ? `Momentum is building — ${s.momentum.score}, up ${s.momentum.delta} on yesterday.`
          : s.momentum.direction === "slipping"
            ? `Momentum is slipping — ${s.momentum.score}, down ${Math.abs(s.momentum.delta)} on yesterday.`
            : `Momentum is stable at ${s.momentum.score}.`;
      const cause =
        s.week.bedOnTime < 60
          ? `The cause is upstream of your mornings: you hit your bedtime on only ${pct(s.week.bedOnTime)} of nights this week, averaging ${formatDelta(s.week.bedAvgDelta)} late.`
          : weakest.week < 60
            ? `The drag is **${weakest.name}** — ${pct(weakest.week)} this week against ${pct(strongest.week)} for ${strongest.name}.`
            : `Nothing is obviously broken; this is normal week-to-week variance.`;
      const fix = s.recovery
        ? `\n\nOne move: ${s.recovery.action}`
        : `\n\nOne move: close **${s.today.open[0] ?? "the day"}** before the evening gets away from you.`;
      return `${dir}\n\n${cause}${fix}`;
    }

    case "week": {
      return `This week: **${pct(s.week.avgScore)} average score**, ${s.week.habitsCompleted} of ${s.week.possible} habits completed, ${s.week.perfectDays} perfect day${s.week.perfectDays === 1 ? "" : "s"}.\n\nWake-ups landed on time ${pct(s.week.wakeOnTime)} of the time (${formatDelta(s.week.wakeAvgDelta)} average), bedtimes ${pct(s.week.bedOnTime)} (${formatDelta(s.week.bedAvgDelta)}). Priorities: ${s.week.prioritiesDone} of ${s.week.prioritiesSet} closed.\n\nStrongest habit is **${strongest.name}** at ${pct(strongest.week)}. Weakest is **${weakest.name}** at ${pct(weakest.week)}. That gap is your whole week in one line.`;
    }

    case "tomorrow": {
      const open = s.today.priorities.filter((p) => !p.done).map((p) => p.title).filter(Boolean);
      return `Tomorrow, one thing decides the rest: **${weakest.name}**. It is running at ${pct(weakest.week)} and it is pulling the other seven down.\n\n${open.length ? `Carry over: ${open.join(" and ")}.` : "Both priorities are closed — pick two new ones tonight, not in the morning."}\n\nSet them before you sleep. Deciding tomorrow at 06:30 is a tax you pay with willpower you need elsewhere.`;
    }

    case "weakest": {
      const danger = s.habits.filter((h) => h.missStatus === "danger");
      return `**${weakest.name}** is holding you back — ${pct(weakest.week)} this week, ${pct(weakest.month)} this month, trend ${weakest.trend >= 0 ? "+" : ""}${weakest.trend}.\n\n${danger.length ? `You have missed ${danger.map((h) => h.name).join(", ")} twice in a row. That is the line where a slip becomes a slide.` : "Nothing has been missed twice in a row, so this is a consistency problem, not a collapse."}\n\n${s.recovery ? `Recovery: ${s.recovery.action}` : "Do the smallest possible version of it today. Two minutes counts."}`;
    }

    case "improving": {
      const first = s.momentum.last14[0] ?? 0;
      const last = s.momentum.last14[s.momentum.last14.length - 1] ?? 0;
      const diff = last - first;
      return `Over fourteen days momentum moved from ${first} to ${last} — ${diff >= 0 ? `up ${diff}` : `down ${Math.abs(diff)}`}.\n\n${diff >= 0 ? "Yes, you are improving, and the improvement is coming from consistency rather than intensity — that is the durable kind." : "Not right now. The habits are still there but the rhythm has loosened; that shows up in momentum before it shows up in results."}\n\nThe honest measure: ${s.week.habitsCompleted} of ${s.week.possible} habits this week, ${s.habits.filter((h) => h.streak >= 7).length} habit${s.habits.filter((h) => h.streak >= 7).length === 1 ? "" : "s"} on a week-plus streak.`;
    }

    case "northstar": {
      if (s.northStar.latest === null) {
        return `Your North Star is **${s.northStar.label}** and there is no number logged yet. Log one today, even a bad one. An unmeasured metric is a wish.`;
      }
      return `**${s.northStar.label}**: ${s.northStar.latest.toLocaleString()} against a target of ${s.northStar.target.toLocaleString()} — ${s.northStar.progress}% of the way.\n\n${s.northStar.change7d !== null ? `Seven-day change ${s.northStar.change7d >= 0 ? "+" : ""}${s.northStar.change7d.toFixed(1)}%.` : ""} ${s.northStar.change30d !== null ? `Thirty-day change ${s.northStar.change30d >= 0 ? "+" : ""}${s.northStar.change30d.toFixed(1)}%.` : ""}\n\nThe number follows the habits with a lag. Keep ${strongest.name} where it is and fix ${weakest.name}.`;
    }

    case "challenge": {
      return `**${s.challenge.title}** — ${s.challenge.progress}% done, ${s.challenge.daysRemaining} days remaining. You are ${s.challenge.pace >= 0 ? `${s.challenge.pace} points ahead of the calendar` : `${Math.abs(s.challenge.pace)} points behind the calendar`}.\n\n${s.challenge.pace >= 0 ? "Do not spend the lead. Take the next milestone this week." : "Take the next milestone this week and the gap closes. Behind is recoverable; drifting is not."}`;
    }

    case "sleep": {
      return `Wake-ups: ${pct(s.week.wakeOnTime)} on time, averaging ${formatDelta(s.week.wakeAvgDelta)}. Bedtimes: ${pct(s.week.bedOnTime)} on time, averaging ${formatDelta(s.week.bedAvgDelta)}.\n\n${s.week.bedOnTime < s.week.wakeOnTime ? "Your mornings are stronger than your nights, which means you are paying for tomorrow's discipline with tonight's sleep. That is a loan with interest." : "Your rhythm is holding on both ends. That is the foundation everything else is sitting on."}\n\nBiggest lever: protect the bedtime, not the alarm.`;
    }

    default: {
      return `Momentum ${s.momentum.score} (${s.momentum.direction}). Today: ${s.today.habitsDone}/${s.today.habitsTotal} habits, ${openCount ? `still open — ${s.today.open.slice(0, 3).join(", ")}` : "all closed"}.\n\nStrongest: **${strongest.name}** (${pct(strongest.week)}). Weakest: **${weakest.name}** (${pct(weakest.week)}).\n\n${s.today.nextAction ? `Next action: ${s.today.nextAction}.` : "Nothing scheduled — pick the weakest habit and close it."}`;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Briefings
 * ------------------------------------------------------------------ */

export interface Briefing {
  mission: string;
  priorities: string[];
  avoid: string;
  hardThing: string;
  northStar: string;
  momentum: number;
}

const AVOIDS = [
  "Don't open social media before your protected morning is complete.",
  "Don't answer the inbox before priority one is finished.",
  "Don't take the meeting that could have been a message.",
  "Don't let a small win talk you out of the hard thing.",
  "Don't negotiate with the alarm.",
];

const HARD_THINGS = [
  "Make the call you have been putting off.",
  "Do the workout at the intensity you avoid.",
  "Ship the thing before it is comfortable.",
  "Say the honest sentence you have been softening.",
  "Start with the task you most want to postpone.",
];

/** Deterministic per day, so the briefing doesn't reshuffle on every render. */
function pick<T>(arr: T[], key: string): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function buildBriefing(state: LifeState, now = new Date()): Briefing {
  const today = dateKey(now);
  const s = buildSnapshot(state, now);
  const day = getDay(state, today);
  const weakest = [...s.habits].sort((a, b) => a.week - b.week)[0];

  return {
    mission: state.profile.mission,
    priorities: day.priorities.map((p) => p.title).filter(Boolean),
    avoid: pick(AVOIDS, today),
    hardThing: pick(HARD_THINGS, today + weakest.id),
    northStar: s.northStar.latest !== null
      ? `${s.northStar.label}: ${s.northStar.latest.toLocaleString()} of ${s.northStar.target.toLocaleString()} (${s.northStar.progress}%)`
      : `${s.northStar.label}: not logged yet today`,
    momentum: s.momentum.score,
  };
}

export function debriefHeadline(state: LifeState, now = new Date()): string {
  const today = dateKey(now);
  const day = getDay(state, today);
  const done = habitsDone(day);
  if (done === HABITS.length) return "Perfect day. Every habit closed.";
  if (done >= 6) return "Strong day. Close the gap tomorrow.";
  if (done >= 4) return "Half a day. Half is still forward.";
  if (done > 0) return "Thin day. Tomorrow is the recovery day.";
  return "Nothing logged. Start with one thing tomorrow.";
}

export function yesterdayComparison(state: LifeState, now = new Date()): string {
  const today = dateKey(now);
  const t = dailyScore(getDay(state, today));
  const y = dailyScore(getDay(state, addDays(today, -1)));
  const diff = t - y;
  if (diff > 0) return `${diff} points better than ${shortDate(addDays(today, -1))}.`;
  if (diff < 0) return `${Math.abs(diff)} points below ${shortDate(addDays(today, -1))}.`;
  return `Level with ${shortDate(addDays(today, -1))}.`;
}
