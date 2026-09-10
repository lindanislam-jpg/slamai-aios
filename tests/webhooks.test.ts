import { test } from "node:test";
import assert from "node:assert/strict";
import { signPayload, verifySignature, generateSecret } from "../src/lib/voice/signing";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ event: "lead.created", data: { score: 92 } });

test("a signature we produced verifies", () => {
  const now = Math.floor(Date.now() / 1000);
  const signature = signPayload(SECRET, now, BODY);
  assert.equal(verifySignature(SECRET, signature, now, BODY), true);
});

test("a tampered body fails verification", () => {
  const now = Math.floor(Date.now() / 1000);
  const signature = signPayload(SECRET, now, BODY);
  const tampered = JSON.stringify({ event: "lead.created", data: { score: 5 } });
  assert.equal(verifySignature(SECRET, signature, now, tampered), false);
});

test("the wrong secret fails verification", () => {
  const now = Math.floor(Date.now() / 1000);
  const signature = signPayload(SECRET, now, BODY);
  assert.equal(verifySignature("whsec_other", signature, now, BODY), false);
});

test("a replayed old signature is rejected", () => {
  const old = Math.floor(Date.now() / 1000) - 600;
  const signature = signPayload(SECRET, old, BODY);
  assert.equal(verifySignature(SECRET, signature, old, BODY), false);
});

test("a signature from the future is rejected", () => {
  const future = Math.floor(Date.now() / 1000) + 600;
  const signature = signPayload(SECRET, future, BODY);
  assert.equal(verifySignature(SECRET, signature, future, BODY), false);
});

test("the timestamp is part of what is signed", () => {
  const now = Math.floor(Date.now() / 1000);
  const signature = signPayload(SECRET, now, BODY);
  assert.equal(verifySignature(SECRET, signature, now - 1, BODY), false);
});

test("generated secrets are unique and prefixed", () => {
  const a = generateSecret();
  const b = generateSecret();
  assert.notEqual(a, b);
  assert.ok(a.startsWith("whsec_"));
  assert.ok(a.length > 40);
});
