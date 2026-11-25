import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

/**
 * Suspension behaviour, end to end.
 *
 * A suspended workspace must still be able to *read* its own data — not least
 * the billing page it has to reach in order to pay — while every action that
 * writes data or spends money is refused. That split is easy to get subtly
 * wrong, and getting it wrong either strands a paying customer or lets a
 * non-paying one keep running up cost, so it is pinned down here.
 *
 * Needs a running server and DATABASE_URL, same as the isolation suite.
 */

const BASE = process.env.E2E_BASE_URL || "http://localhost:3005";
const db = new PrismaClient();

let cookies = "";
let businessId = "";

async function signUp() {
  const email = `e2e-susp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "e2e-test-password-1234";

  const signup = await fetch(`${BASE}/api/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Suspended Owner",
      email,
      password,
      businessName: "Suspension Test Business",
      industry: "plumbing",
      country: "IE",
      timezone: "Europe/Dublin",
    }),
  });
  assert.equal(signup.status, 201);
  businessId = ((await signup.json()) as { businessId: string }).businessId;

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const csrf = (csrfResponse.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrf },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
    redirect: "manual",
  });

  const jar = new Map<string, string>();
  const all = [...csrf.split("; "), ...(login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0])];
  for (const part of all) {
    if (!part) continue;
    const [k, ...v] = part.split("=");
    jar.set(k, v.join("="));
  }
  cookies = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookies, ...init.headers },
  });
  return { status: response.status };
}

before(async () => {
  await signUp();
  await db.business.update({
    where: { id: businessId },
    data: { status: "suspended", suspendedAt: new Date(), suspendReason: "e2e test" },
  });
});

test("a suspended workspace can still read its own data", async () => {
  for (const path of ["/api/v1/dashboard", "/api/v1/business", "/api/v1/calls", "/api/v1/leads"]) {
    const { status } = await call(path);
    assert.equal(status, 200, `${path} should stay readable while suspended`);
  }
});

test("a suspended workspace can still reach billing to pay its bill", async () => {
  const { status } = await call("/api/v1/billing");
  assert.equal(status, 200, "locking a customer out of billing means they cannot reactivate");
});

test("a suspended workspace cannot write", async () => {
  const writes: [string, RequestInit][] = [
    ["/api/v1/leads", { method: "POST", body: JSON.stringify({ name: "Nope", phone: "+353870009999" }) }],
    ["/api/v1/business", { method: "PATCH", body: JSON.stringify({ name: "Renamed while suspended" }) }],
    ["/api/v1/agents", { method: "POST", body: JSON.stringify({ name: "New agent" }) }],
  ];

  for (const [path, init] of writes) {
    const { status } = await call(path, init);
    assert.equal(status, 403, `${path} should be refused while suspended`);
  }
});

test("a suspended workspace cannot spend money on the test console", async () => {
  // Nothing is persisted by a test turn, but it does spend AI tokens — and a
  // workspace is usually suspended for not paying.
  const { status } = await call("/api/v1/test-call", {
    method: "POST",
    body: JSON.stringify({ message: "hello", history: [] }),
  });
  assert.equal(status, 403, "a suspended workspace must not be able to run up AI cost");
});

test("reactivating restores writes", async () => {
  await db.business.update({
    where: { id: businessId },
    data: { status: "active", suspendedAt: null, suspendReason: null },
  });

  const { status } = await call("/api/v1/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Back in business", phone: "+353870008888" }),
  });
  assert.equal(status, 201);
});

after(async () => {
  await db.business.delete({ where: { id: businessId } }).catch(() => undefined);
  await db.$disconnect();
});
