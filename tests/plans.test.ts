import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_PLANS, PURCHASABLE_PLANS, getVoicePlan, planAllows, isWithinLimit,
} from "../src/lib/voice/plans";

test("the advertised prices are the ones in the config", () => {
  assert.equal(getVoicePlan("starter").price, 99);
  assert.equal(getVoicePlan("business").price, 249);
  assert.equal(getVoicePlan("pro").price, 499);
});

test("an unknown plan falls back to the trial rather than throwing", () => {
  assert.equal(getVoicePlan("nonsense").id, "trial");
  assert.equal(getVoicePlan(null).id, "trial");
  assert.equal(getVoicePlan(undefined).id, "trial");
});

test("the trial cannot be bought", () => {
  assert.ok(!PURCHASABLE_PLANS.some((p) => p.id === "trial"));
});

test("plan ids are unique", () => {
  const ids = VOICE_PLANS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("exactly one plan is marked most popular", () => {
  assert.equal(VOICE_PLANS.filter((p) => p.popular).length, 1);
});

test("included minutes increase with price", () => {
  const paid = PURCHASABLE_PLANS.filter((p) => p.limits.minutes !== null);
  for (let i = 1; i < paid.length; i++) {
    assert.ok(
      (paid[i].limits.minutes ?? 0) > (paid[i - 1].limits.minutes ?? 0),
      `${paid[i].name} should include more minutes than ${paid[i - 1].name}`
    );
  }
});

test("feature gates match the plan ladder", () => {
  assert.equal(planAllows("starter", "webhooks"), false);
  assert.equal(planAllows("business", "webhooks"), true);
  assert.equal(planAllows("business", "api"), false);
  assert.equal(planAllows("pro", "api"), true);
});

test("a null limit means unlimited", () => {
  assert.equal(isWithinLimit(null, 1_000_000), true);
  assert.equal(isWithinLimit(3, 2), true);
  assert.equal(isWithinLimit(3, 3), false);
  assert.equal(isWithinLimit(0, 0), false);
});
