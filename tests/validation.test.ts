import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signupSchema, agentSchema, appointmentSchema, e164, webhookEndpointSchema, leadSchema,
  notificationRuleSchema,
} from "../src/lib/voice/validation";

test("signup requires a real email and a long password", () => {
  assert.equal(signupSchema.safeParse({
    name: "Dec", email: "not-an-email", password: "averylongpassword", businessName: "ABC",
  }).success, false);

  assert.equal(signupSchema.safeParse({
    name: "Dec", email: "dec@abc.ie", password: "short", businessName: "ABC",
  }).success, false);

  assert.equal(signupSchema.safeParse({
    name: "Dec", email: "dec@abc.ie", password: "a-long-enough-password", businessName: "ABC Plumbing",
  }).success, true);
});

test("signup defaults an unknown trade rather than failing", () => {
  const result = signupSchema.safeParse({
    name: "Dec", email: "dec@abc.ie", password: "a-long-enough-password",
    businessName: "ABC", industry: "space-mining",
  });
  assert.equal(result.success, false, "an invalid industry key must be rejected, not silently accepted");
});

test("phone numbers must be in international format", () => {
  assert.equal(e164.safeParse("+353871234567").success, true);
  assert.equal(e164.safeParse("087 123 4567").success, false);
  assert.equal(e164.safeParse("+0123").success, false);
  assert.equal(e164.safeParse("").success, false);
});

test("an agent's speaking rate is bounded", () => {
  assert.equal(agentSchema.safeParse({ speakingRate: 1.0 }).success, true);
  assert.equal(agentSchema.safeParse({ speakingRate: 3 }).success, false);
  assert.equal(agentSchema.safeParse({ speakingRate: 0.1 }).success, false);
});

test("an agent cannot be given an unlimited turn budget", () => {
  assert.equal(agentSchema.safeParse({ maxTurns: 25 }).success, true);
  assert.equal(agentSchema.safeParse({ maxTurns: 5000 }).success, false);
});

test("an appointment needs a valid timestamp", () => {
  assert.equal(appointmentSchema.safeParse({
    title: "Boiler service", startsAt: "2026-05-14T10:30:00.000Z",
  }).success, true);

  assert.equal(appointmentSchema.safeParse({
    title: "Boiler service", startsAt: "next Tuesday",
  }).success, false);
});

test("a webhook endpoint must be a URL and only known events", () => {
  assert.equal(webhookEndpointSchema.safeParse({
    name: "n8n", url: "https://example.com/hook", events: ["lead.created"],
  }).success, true);

  assert.equal(webhookEndpointSchema.safeParse({
    name: "n8n", url: "not a url", events: [],
  }).success, false);

  assert.equal(webhookEndpointSchema.safeParse({
    name: "n8n", url: "https://example.com/hook", events: ["lead.stolen"],
  }).success, false);
});

test("a lead score outside 0-100 is rejected", () => {
  assert.equal(leadSchema.safeParse({ score: 50 }).success, true);
  assert.equal(leadSchema.safeParse({ score: 150 }).success, false);
  assert.equal(leadSchema.safeParse({ score: -1 }).success, false);
});

test("a lead status must be one we recognise", () => {
  assert.equal(leadSchema.safeParse({ status: "qualified" }).success, true);
  assert.equal(leadSchema.safeParse({ status: "maybe" }).success, false);
});

test("a notification target must match the shape its channel needs", () => {
  const ok = (channel: string, target: string) =>
    notificationRuleSchema.safeParse({ event: "lead.created", channel, target }).success;

  assert.equal(ok("email", "owner@business.ie"), true);
  assert.equal(ok("email", "not-an-email"), false);

  assert.equal(ok("sms", "+353871234567"), true);
  assert.equal(ok("sms", "087 123 4567"), false);

  assert.equal(ok("webhook", "https://example.com/hook"), true);
  assert.equal(ok("webhook", "definitely not a url"), false);
});

test("a notification webhook cannot smuggle in a non-http scheme", () => {
  // The server fetches this target, so file:// and friends must not reach it.
  for (const target of ["file:///etc/passwd", "gopher://internal:70/", "ftp://internal/"]) {
    assert.equal(
      notificationRuleSchema.safeParse({ event: "lead.created", channel: "webhook", target }).success,
      false,
      `${target} should be rejected`
    );
  }
});
