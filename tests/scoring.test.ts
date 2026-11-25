import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLead, bandFor, type LeadSignals } from "../src/lib/voice/scoring";

const base: LeadSignals = {
  hasPhone: false, hasEmail: false, hasName: false, namedService: false,
  booked: false, urgency: "normal", intent: "unknown", durationSec: 60,
  highValue: false, readyToProceed: false,
};

test("a caller who left nothing scores near zero", () => {
  const result = scoreLead({ ...base, durationSec: 15 });
  assert.equal(result.score, 0);
  assert.equal(result.band, "cold");
});

test("an emergency booking with full details scores hot", () => {
  const result = scoreLead({
    ...base,
    hasPhone: true, hasName: true, namedService: true, booked: true,
    urgency: "emergency", intent: "book", durationSec: 180, readyToProceed: true,
  });
  assert.ok(result.score >= 75, `expected a hot score, got ${result.score}`);
  assert.equal(result.band, "hot");
});

test("a cold sales call is penalised even with contact details", () => {
  const withDetails = scoreLead({ ...base, hasPhone: true, hasName: true, intent: "enquiry" });
  const spam = scoreLead({ ...base, hasPhone: true, hasName: true, intent: "spam" });
  assert.ok(spam.score < withDetails.score);
});

test("scores never leave the 0-100 range", () => {
  const maxed = scoreLead({
    ...base,
    hasPhone: true, hasEmail: true, hasName: true, namedService: true, booked: true,
    urgency: "emergency", intent: "book", durationSec: 600, highValue: true, readyToProceed: true,
  });
  assert.ok(maxed.score <= 100);
  assert.ok(maxed.score >= 0);
});

test("every scored lead explains itself", () => {
  const result = scoreLead({ ...base, hasPhone: true, intent: "book" });
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.some((r) => r.includes("phone number captured")));
});

test("band boundaries are exact", () => {
  assert.equal(bandFor(75), "hot");
  assert.equal(bandFor(74), "warm");
  assert.equal(bandFor(45), "warm");
  assert.equal(bandFor(44), "cold");
});
