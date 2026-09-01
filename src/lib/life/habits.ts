import type { HabitDef, HabitId } from "./types";

/**
 * The eight habits the whole system is built around. Order matters: it is the
 * order of the day, not an arbitrary list — the night habit comes first because
 * tomorrow is won tonight.
 */
export const HABITS: HabitDef[] = [
  {
    id: "win-tomorrow",
    index: 1,
    name: "Win Tomorrow Tonight",
    verb: "Set tomorrow up",
    principle: "Tomorrow starts tonight.",
    description:
      "Close the day deliberately. Decide tomorrow's two priorities, lay out what you need, and go to bed on time.",
    icon: "MoonStar",
    hue: 258,
    href: "/life/night",
    phase: "night",
    weight: 1,
  },
  {
    id: "protect-morning",
    index: 2,
    name: "Protect Your Morning",
    verb: "Guard the first hour",
    principle: "The first 60 minutes belong to you.",
    description:
      "No news, no feeds, no inbox. Get up, hydrate, move your body, protect your mind before the world gets a vote.",
    icon: "Sunrise",
    hue: 32,
    href: "/life/morning",
    phase: "morning",
    weight: 1,
  },
  {
    id: "journal",
    index: 3,
    name: "Mindful Journalling",
    verb: "Clear your mind",
    principle: "Get it out of your head.",
    description:
      "Brain dump, choose today's two, name three things you are grateful for. A clear head makes better decisions.",
    icon: "PenLine",
    hue: 190,
    href: "/life/journal",
    phase: "morning",
    weight: 1,
  },
  {
    id: "learn",
    index: 4,
    name: "Learn Daily",
    verb: "Feed the mind",
    principle: "Ten pages a day compounds.",
    description:
      "Read or study, then capture the golden nugget, how you will apply it, and who you will teach it to.",
    icon: "BookOpen",
    hue: 152,
    href: "/life/learning",
    phase: "morning",
    weight: 1,
  },
  {
    id: "environment",
    index: 5,
    name: "Environment Engineering",
    verb: "Shape the room",
    principle: "Make good habits easy. Make bad habits hard.",
    description:
      "Discipline is expensive, design is cheap. Change the people and places so the right action is the default one.",
    icon: "Boxes",
    hue: 288,
    href: "/life/environment",
    phase: "day",
    weight: 1,
  },
  {
    id: "measure",
    index: 6,
    name: "Measure What Matters",
    verb: "Log the North Star",
    principle: "One number. Every day.",
    description:
      "Track the single metric that moves your life forward. What gets measured honestly is what improves.",
    icon: "Target",
    hue: 210,
    href: "/life/north-star",
    phase: "day",
    weight: 1,
  },
  {
    id: "momentum",
    index: 7,
    name: "Fight For Momentum",
    verb: "Never miss twice",
    principle: "Never let a slip become a slide.",
    description:
      "Motivation follows action. When momentum drops, the answer is one small move — today, not tomorrow.",
    icon: "Activity",
    hue: 4,
    href: "/life/momentum",
    phase: "day",
    weight: 1,
  },
  {
    id: "choose-hard",
    index: 8,
    name: "Choose Hard",
    verb: "Do the hard thing",
    principle: "Easy choices, hard life. Hard choices, easy life.",
    description:
      "Every day, deliberately pick the uncomfortable option. That is where the version of you that you want lives.",
    icon: "Mountain",
    hue: 20,
    href: "/life/choose-hard",
    phase: "day",
    weight: 1,
  },
];

export const HABIT_IDS = HABITS.map((h) => h.id);

export const HABIT_BY_ID: Record<HabitId, HabitDef> = Object.fromEntries(
  HABITS.map((h) => [h.id, h]),
) as Record<HabitId, HabitDef>;

export interface RoutineStep {
  id: string;
  label: string;
  detail: string;
  /** Minutes after wake-up (morning) or before bedtime (night). */
  offset: number;
  minutes: number;
  icon: string;
  habit?: HabitId;
}

/** The protected morning, in order. Offsets are minutes after the wake alarm. */
export const MORNING_STEPS: RoutineStep[] = [
  { id: "wake", label: "Get out of bed", detail: "Feet on the floor. No snooze.", offset: 0, minutes: 2, icon: "AlarmClockCheck", habit: "protect-morning" },
  { id: "water", label: "Drink water", detail: "500ml before anything else.", offset: 2, minutes: 3, icon: "GlassWater" },
  { id: "move", label: "Move your body", detail: "20 minutes. Sweat, stretch or walk.", offset: 5, minutes: 20, icon: "Dumbbell" },
  { id: "mind", label: "Protect your mind", detail: "No feeds, no news, no inbox.", offset: 25, minutes: 5, icon: "ShieldCheck" },
  { id: "journal", label: "Journal", detail: "Brain dump, today's two, gratitude.", offset: 30, minutes: 10, icon: "PenLine", habit: "journal" },
  { id: "learn", label: "Learning block", detail: "Ten pages and one golden nugget.", offset: 40, minutes: 15, icon: "BookOpen", habit: "learn" },
  { id: "priority", label: "Priority #1", detail: "The hardest thing, first.", offset: 55, minutes: 5, icon: "Flag" },
];

/** The wind-down, in order. Offsets are minutes before the bedtime alarm. */
export const NIGHT_STEPS: RoutineStep[] = [
  { id: "debrief", label: "Debrief the day", detail: "What went well, what didn't, what changes.", offset: 45, minutes: 8, icon: "ClipboardCheck", habit: "win-tomorrow" },
  { id: "tomorrow", label: "Set tomorrow's two", detail: "Decide now so morning-you doesn't have to.", offset: 35, minutes: 5, icon: "ListChecks", habit: "win-tomorrow" },
  { id: "prepare", label: "Prepare the environment", detail: "Clothes out, desk clear, water filled.", offset: 28, minutes: 6, icon: "Boxes", habit: "environment" },
  { id: "offline", label: "Screens down", detail: "Phone out of the bedroom.", offset: 20, minutes: 5, icon: "SmartphoneNfc" },
  { id: "wind", label: "Wind down", detail: "Read, stretch, breathe.", offset: 15, minutes: 15, icon: "Wind" },
];

/** Steps of the wake-up sequence shown on the alarm screen. */
export const WAKE_SEQUENCE = [
  { id: "wake", label: "Get out of bed", line: "Feet on the floor." },
  { id: "water", label: "Drink water", line: "500ml. Right now." },
  { id: "move", label: "Move your body", line: "Twenty minutes." },
  { id: "mind", label: "Protect your mind", line: "No feeds. No inbox." },
];
