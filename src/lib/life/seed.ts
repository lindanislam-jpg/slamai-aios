import { addDays, dateKey, minutesToClock, clockToMinutes, parseKey } from "./date";
import { HABITS } from "./habits";
import type { DayRecord, HabitId, ISODate, LifeState, Settings } from "./types";
import { STATE_VERSION } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  wakeTime: "06:30",
  bedTime: "22:30",
  protectedMinutes: 60,
  windDownMinutes: 45,
  alarmsEnabled: true,
  wakeAlarmEnabled: true,
  bedAlarmEnabled: true,
  sound: true,
  volume: 0.6,
  theme: "dark",
  accent: "aurora",
  reducedMotion: false,
  showDemoHistory: true,
  notificationsAsked: false,
};

/** Deterministic PRNG so the demo history is identical on every install. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRAIN_DUMPS = [
  "Three things circling: the launch copy, the call with the supplier, and whether I'm building the right thing at all. Writing it down already makes it smaller.",
  "Woke up thinking about the pricing page. It's not the price, it's that I haven't made the promise clear enough.",
  "Slept badly. Head is loud. Getting the noise onto the page so the day can be quiet.",
  "Good energy today. The system is starting to run me instead of the other way round.",
  "Too many open loops. Closing three today, no matter how small.",
];

const NUGGETS = [
  "Depth is a competitive advantage precisely because everyone else is shallow.",
  "You do not rise to the level of your goals, you fall to the level of your systems.",
  "The cost of context switching is paid in the quality of the work, not the clock.",
  "Consistency beats intensity over any horizon longer than a week.",
  "Ambition without a schedule is just anxiety.",
];

const GRATITUDE = [
  ["Health to train this morning", "Work that is actually mine", "A quiet hour before the world woke up"],
  ["Coffee and a clear desk", "A friend who tells me the truth", "The fact I started at all"],
  ["Rain on the window", "Momentum I built last month", "Someone who believed me before it worked"],
];

const PRIORITIES = [
  ["Ship the onboarding flow", "Call three prospects"],
  ["Write the launch page", "Deep work block: pricing model"],
  ["Record the demo video", "Close the outstanding invoice"],
  ["Fix the booking bug", "Follow up with the two warm leads"],
  ["Draft next month's plan", "One hard training session"],
];

/**
 * Generates a plausible 90-day history so the analytics have something to say on
 * day one. Every row is flagged `seeded: true` — the UI labels it as demo data
 * and Settings can hide or delete it in one action.
 */
export function buildDemoHistory(today: ISODate = dateKey()): Record<ISODate, DayRecord> {
  const rand = mulberry32(20260901);
  const days: Record<ISODate, DayRecord> = {};
  const span = 90;

  for (let i = span; i >= 1; i--) {
    const key = addDays(today, -i);
    const date = parseKey(key);
    const dow = (date.getDay() + 6) % 7;
    const weekend = dow >= 5;
    // Discipline grows over the 90 days: this is a person building a system.
    const maturity = 0.42 + (1 - i / span) * 0.5;

    const habits: Partial<Record<HabitId, boolean>> = {};
    for (const h of HABITS) {
      let p = maturity;
      if (h.id === "learn") p += 0.12;
      if (h.id === "protect-morning") p += 0.08;
      if (h.id === "choose-hard") p -= 0.12;
      if (h.id === "win-tomorrow" && i < 8) p -= 0.28; // the recent bedtime slip
      if (weekend) p -= 0.1;
      habits[h.id] = rand() < p;
    }
    // A 21-day learning streak, deliberately, so the streak UI has a story.
    if (i <= 21) habits.learn = true;

    const wakeTarget = "06:30";
    const bedTarget = "22:30";
    const wakeDrift = Math.round((rand() * 14 - 3) * (weekend ? 2.2 : 1));
    const bedDrift = Math.round(rand() * 30 - 8 + (i < 8 ? 42 * rand() : 0));
    const wokeUp = habits["protect-morning"] || rand() < 0.85;

    const morning: Record<string, string> = {};
    if (wokeUp) {
      const base = clockToMinutes(wakeTarget) + wakeDrift;
      morning.wake = minutesToClock(base);
      if (rand() < 0.92) morning.water = minutesToClock(base + 3);
      if (rand() < maturity + 0.2) morning.move = minutesToClock(base + 6);
      if (habits["protect-morning"]) morning.mind = minutesToClock(base + 26);
      if (habits.journal) morning.journal = minutesToClock(base + 31);
      if (habits.learn) morning.learn = minutesToClock(base + 42);
    }

    const priorities = PRIORITIES[Math.floor(rand() * PRIORITIES.length)];
    const p1Done = rand() < maturity + 0.15;
    const p2Done = rand() < maturity - 0.05;

    days[key] = {
      date: key,
      habits,
      morning,
      wakeTarget,
      bedTarget,
      wakeActual: wokeUp ? minutesToClock(clockToMinutes(wakeTarget) + wakeDrift) : undefined,
      bedActual: minutesToClock(clockToMinutes(bedTarget) + bedDrift),
      priorities: [
        { id: `${key}-p1`, title: priorities[0], done: p1Done },
        { id: `${key}-p2`, title: priorities[1], done: p2Done },
      ],
      journal: habits.journal
        ? {
            brainDump: BRAIN_DUMPS[Math.floor(rand() * BRAIN_DUMPS.length)],
            gratitude: GRATITUDE[Math.floor(rand() * GRATITUDE.length)] as [string, string, string],
            completedAt: `${key}T07:15:00`,
          }
        : undefined,
      learning: habits.learn
        ? {
            pages: 8 + Math.floor(rand() * 9),
            nugget: NUGGETS[Math.floor(rand() * NUGGETS.length)],
            apply: "Block the first 90 minutes tomorrow for the hardest task, phone in another room.",
            teach: "Share it with the team on Monday.",
            completedAt: `${key}T07:35:00`,
          }
        : undefined,
      northStar: Math.round(4180 + (1 - i / span) * 4240 + (rand() * 420 - 210)),
      debrief: habits["win-tomorrow"]
        ? {
            wentWell: "Protected the morning and got priority one done before 10am.",
            didnt: "Let the inbox pull me around after lunch.",
            learned: "The day is decided before 9am.",
            change: "Inbox stays closed until priority one is finished.",
            completedAt: `${key}T21:50:00`,
          }
        : undefined,
      xp: 0,
      seeded: true,
    };
  }

  return days;
}

export function createInitialState(today: ISODate = dateKey()): LifeState {
  return {
    version: STATE_VERSION,
    profile: {
      name: "Lindani",
      mission: "Build something people can't ignore, without burning the person who built it.",
    },
    settings: { ...DEFAULT_SETTINGS },
    days: buildDemoHistory(today),
    northStar: {
      label: "Business Growth",
      unit: "€",
      unitPosition: "prefix",
      target: 10000,
      direction: "up",
    },
    challenge: {
      title: "Build Something Great",
      why: "Because the version of me I want lives on the other side of finishing this.",
      startDate: addDays(today, -48),
      endDate: addDays(today, 42),
      milestones: [
        { id: "m1", label: "Commit publicly", at: 0.06, done: true, doneOn: addDays(today, -47) },
        { id: "m2", label: "First working prototype", at: 0.18, done: true, doneOn: addDays(today, -39) },
        { id: "m3", label: "Ten real conversations", at: 0.3, done: true, doneOn: addDays(today, -30) },
        { id: "m4", label: "First paying customer", at: 0.42, done: true, doneOn: addDays(today, -21) },
        { id: "m5", label: "Rebuild on real feedback", at: 0.54, done: true, doneOn: addDays(today, -11) },
        { id: "m6", label: "Ten customers", at: 0.67, done: true, doneOn: addDays(today, -3) },
        { id: "m7", label: "Repeatable acquisition", at: 0.79, done: false },
        { id: "m8", label: "Hit the North Star", at: 0.9, done: false },
        { id: "m9", label: "Ship it publicly", at: 1, done: false },
      ],
    },
    book: {
      title: "Deep Work",
      author: "Cal Newport",
      totalPages: 296,
      dailyTarget: 10,
      startedOn: addDays(today, -21),
    },
    people: [
      { id: "p1", name: "Thabo", relation: "Business partner", impact: "raises", note: "Pushes the standard up every single week. More time here." },
      { id: "p2", name: "Nomsa", relation: "Mentor", impact: "raises", note: "Monthly call. Ask harder questions next time." },
      { id: "p3", name: "The training crew", relation: "Gym", impact: "raises", note: "Turning up is easier because they're there." },
      { id: "p4", name: "Old work group chat", relation: "Former colleagues", impact: "neutral", note: "Warm, but pulls the conversation backwards." },
      { id: "p5", name: "Sam", relation: "Friend", impact: "drains", note: "Every conversation ends in complaints. Reduce to daylight only." },
    ],
    places: [
      { id: "pl1", name: "Workspace", category: "physical", status: "optimized", note: "Desk cleared each night. Phone charges in the hall." },
      { id: "pl2", name: "Home", category: "physical", status: "needs-work", note: "TV is still the default. Move the reading chair." },
      { id: "pl3", name: "Gym", category: "physical", status: "optimized", note: "Bag packed the night before. Nine minutes away." },
      { id: "pl4", name: "Phone", category: "digital", status: "needs-work", note: "Home screen is clean, but notifications are still loud." },
      { id: "pl5", name: "Social media", category: "digital", status: "hostile", note: "Apps deleted from phone. Browser only, after 18:00." },
      { id: "pl6", name: "Inbox", category: "digital", status: "needs-work", note: "Opens too early. Closed until priority one is done." },
    ],
    envChanges: [
      { id: "e1", kind: "easy", text: "Training clothes laid out the night before", done: true, createdOn: addDays(today, -30) },
      { id: "e2", kind: "easy", text: "Book on the pillow, not the shelf", done: true, createdOn: addDays(today, -24) },
      { id: "e3", kind: "hard", text: "Social apps deleted from the phone", done: true, createdOn: addDays(today, -18) },
      { id: "e4", kind: "hard", text: "Phone charges outside the bedroom", done: false, createdOn: addDays(today, -6) },
      { id: "e5", kind: "easy", text: "Water bottle filled and beside the bed", done: false, createdOn: addDays(today, -2) },
    ],
    coach: [],
    seededAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
