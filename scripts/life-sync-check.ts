/**
 * Checks the sync merge rules hold. Run with `npx tsx scripts/life-sync-check.ts`.
 *
 * These are the cases that decide whether a day's work can go missing, so they
 * are worth being able to re-run rather than reasoning about once.
 */
import { differsFrom, mergeStates } from "../src/lib/life/sync";
import { createInitialState } from "../src/lib/life/seed";
import type { LifeState } from "../src/lib/life/types";

let failures = 0;
function check(name: string, condition: boolean) {
  console.log(`${condition ? "  ok  " : " FAIL "} ${name}`);
  if (!condition) failures++;
}

const base = (): LifeState => createInitialState("2026-09-02");

const withDay = (s: LifeState, date: string, xp: number, at: number): LifeState => ({
  ...s,
  days: {
    ...s.days,
    [date]: {
      date,
      habits: {},
      morning: {},
      priorities: [],
      xp,
      updatedAt: at,
    },
  },
});

/* 1. Different days on each device: both survive. This is the whole point —
      wake up on the laptop, journal on the phone. */
{
  const laptop = withDay(base(), "2026-09-01", 10, 1000);
  const phone = withDay(base(), "2026-09-02", 20, 2000);
  const merged = mergeStates(laptop, phone);
  check("keeps a day only the laptop has", merged.days["2026-09-01"]?.xp === 10);
  check("keeps a day only the phone has", merged.days["2026-09-02"]?.xp === 20);
}

/* 2. Same day edited on both: the newer edit wins, whichever side it is on. */
{
  const older = withDay(base(), "2026-09-02", 10, 1000);
  const newer = withDay(base(), "2026-09-02", 99, 5000);
  check("newer remote day wins", mergeStates(older, newer).days["2026-09-02"].xp === 99);
  check("newer local day wins", mergeStates(newer, older).days["2026-09-02"].xp === 99);
}

/* 3. A tie goes to the device in front of you, so an edit never appears to
      undo itself. */
{
  const local = withDay(base(), "2026-09-02", 7, 1000);
  const remote = withDay(base(), "2026-09-02", 8, 1000);
  check("a tie keeps the local edit", mergeStates(local, remote).days["2026-09-02"].xp === 7);
}

/* 4. Singletons travel together from the more recently touched side. */
{
  const local: LifeState = { ...base(), touchedAt: 100, profile: { name: "Local", mission: "L" } };
  const remote: LifeState = {
    ...base(),
    touchedAt: 900,
    profile: { name: "Remote", mission: "R" },
    people: [{ id: "x", name: "Kept", relation: "friend", impact: "raises", note: "" }],
  };
  const merged = mergeStates(local, remote);
  check("newer side's profile wins", merged.profile.name === "Remote");
  check("newer side's people come with it", merged.people.length === 1);
  check("touchedAt carries the max", merged.touchedAt === 900);
}

/* 5. A day is never lost just because the other side owns the singletons. */
{
  const local = { ...withDay(base(), "2026-09-01", 42, 500), touchedAt: 1 };
  const remote = { ...base(), touchedAt: 999 };
  check("day survives losing the singleton race", mergeStates(local, remote).days["2026-09-01"]?.xp === 42);
}

/* 6. The coach transcript is append-only and merges by id. */
{
  const local: LifeState = {
    ...base(),
    coach: [{ id: "a", role: "user", content: "hi", at: "2026-09-02T08:00:00.000Z" }],
  };
  const remote: LifeState = {
    ...base(),
    coach: [{ id: "b", role: "coach", content: "hello", at: "2026-09-02T09:00:00.000Z" }],
  };
  const merged = mergeStates(local, remote);
  check("both coach messages kept", merged.coach.length === 2);
  check("coach messages ordered oldest first", merged.coach[0].id === "a");
}

/* 7. differsFrom only reports a push is owed when something actually changed. */
{
  const same = withDay(base(), "2026-09-02", 5, 700);
  check("identical states need no push", !differsFrom(same, same));
  check("a newer day needs a push", differsFrom(withDay(same, "2026-09-03", 1, 800), same));
}

/* 8. The install date is the earlier of the two — you have been going since
      the first device, not the newest one. */
{
  const older: LifeState = { ...base(), createdAt: "2026-01-01T00:00:00.000Z" };
  const newer: LifeState = { ...base(), createdAt: "2026-09-02T00:00:00.000Z" };
  check("keeps the earlier createdAt", mergeStates(newer, older).createdAt === "2026-01-01T00:00:00.000Z");
}

console.log(failures === 0 ? "\nAll sync checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
