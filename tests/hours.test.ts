import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenAt, describeHours, zonedParts, DEFAULT_HOURS, type HourRow } from "../src/lib/voice/hours";

const NINE_TO_FIVE: HourRow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isOpen: weekday >= 1 && weekday <= 5,
  opensAt: "09:00",
  closesAt: "17:00",
}));

test("a Wednesday lunchtime in Dublin is open", () => {
  // 2026-05-13 is a Wednesday. 12:00 UTC is 13:00 Irish summer time.
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", new Date("2026-05-13T12:00:00Z")), true);
});

test("a Wednesday evening in Dublin is closed", () => {
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", new Date("2026-05-13T21:00:00Z")), false);
});

test("Sunday is closed", () => {
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", new Date("2026-05-17T12:00:00Z")), false);
});

test("the same instant can be open in one timezone and closed in another", () => {
  // 16:30 UTC on a Wednesday: 17:30 in Dublin (closed), 09:30 in Los Angeles (open).
  const instant = new Date("2026-05-13T16:30:00Z");
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", instant), false);
  assert.equal(isOpenAt(NINE_TO_FIVE, "America/Los_Angeles", instant), true);
});

test("daylight saving is handled, not assumed", () => {
  // 08:30 UTC in January is 08:30 in Dublin (closed); in July it is 09:30 (open).
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", new Date("2026-01-14T08:30:00Z")), false);
  assert.equal(isOpenAt(NINE_TO_FIVE, "Europe/Dublin", new Date("2026-07-15T08:30:00Z")), true);
});

test("hours that run past midnight still work", () => {
  const lateNight: HourRow[] = NINE_TO_FIVE.map((row) =>
    row.weekday === 3 ? { ...row, opensAt: "18:00", closesAt: "02:00" } : row
  );
  // 23:00 Wednesday Irish time.
  assert.equal(isOpenAt(lateNight, "Europe/Dublin", new Date("2026-05-13T22:00:00Z")), true);
});

test("zonedParts reports the local weekday, not the UTC one", () => {
  // 23:30 UTC on a Wednesday is already Thursday in Sydney.
  const parts = zonedParts(new Date("2026-05-13T23:30:00Z"), "Australia/Sydney");
  assert.equal(parts.weekday, 4);
});

test("hours are described in plain language", () => {
  const text = describeHours(DEFAULT_HOURS);
  assert.ok(text.includes("Monday"));
  assert.ok(!text.includes("Sunday"), "closed days should not be listed");
});
