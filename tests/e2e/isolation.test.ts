import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * End-to-end tenant isolation and authorization tests.
 *
 * These run against a real running server and a real database, because that is
 * the only way to prove the tenancy boundary actually holds — a mocked session
 * would be testing the mock, not the gate.
 *
 *   npm run build && npm run start        (in one terminal)
 *   npm run test:e2e                      (in another)
 *
 * The suite creates two throwaway businesses, so it is safe to run against a
 * development database. It never touches existing data.
 */

const BASE = process.env.E2E_BASE_URL || "http://localhost:3005";

type Session = { cookies: string; businessId: string; email: string };

/** Signs a new business up and returns a session with its cookies. */
async function createTenant(label: string): Promise<Session> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "e2e-test-password-1234";

  const signup = await fetch(`${BASE}/api/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${label} Owner`,
      email,
      password,
      businessName: `${label} Test Business`,
      industry: "plumbing",
      country: "IE",
      timezone: "Europe/Dublin",
    }),
  });

  assert.equal(signup.status, 201, `signup for ${label} should succeed`);
  const { businessId } = (await signup.json()) as { businessId: string };

  return { cookies: await signIn(email, password), businessId, email };
}

/** Performs the NextAuth credentials flow and returns the session cookie jar. */
async function signIn(email: string, password: string): Promise<string> {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookies = collectCookies(csrfResponse);

  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookies },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE}/app`, json: "true" }),
    redirect: "manual",
  });

  const jar = mergeCookies(csrfCookies, collectCookies(login));
  assert.ok(
    jar.includes("authjs.session-token") || jar.includes("next-auth.session-token"),
    "sign-in should set a session cookie"
  );
  return jar;
}

function collectCookies(response: Response): string {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((cookie) => cookie.split(";")[0]).join("; ");
}

function mergeCookies(a: string, b: string): string {
  const jar = new Map<string, string>();
  for (const part of [...a.split("; "), ...b.split("; ")]) {
    if (!part) continue;
    const [name, ...rest] = part.split("=");
    jar.set(name, rest.join("="));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function call(session: Session | null, path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session && { Cookie: session.cookies }),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body: body as Record<string, unknown> };
}

let alpha: Session;
let bravo: Session;

before(async () => {
  alpha = await createTenant("alpha");
  bravo = await createTenant("bravo");
});

test("signing up creates a separate workspace per business", () => {
  assert.notEqual(alpha.businessId, bravo.businessId);
});

test("every tenant endpoint refuses an anonymous request", async () => {
  const paths = [
    "/api/v1/dashboard", "/api/v1/business", "/api/v1/agents", "/api/v1/calls",
    "/api/v1/leads", "/api/v1/appointments", "/api/v1/knowledge",
    "/api/v1/phone-numbers", "/api/v1/team", "/api/v1/analytics",
    "/api/v1/usage", "/api/v1/billing", "/api/v1/audit",
  ];

  for (const path of paths) {
    const { status } = await call(null, path);
    assert.ok(status === 401 || status === 403, `${path} returned ${status} to an anonymous caller`);
  }
});

test("a signed-in owner only sees their own workspace", async () => {
  const alphaView = await call(alpha, "/api/v1/business");
  const bravoView = await call(bravo, "/api/v1/business");

  assert.equal(alphaView.status, 200);
  assert.equal(bravoView.status, 200);

  const alphaBusiness = alphaView.body.business as { id: string; name: string };
  const bravoBusiness = bravoView.body.business as { id: string; name: string };

  assert.equal(alphaBusiness.id, alpha.businessId);
  assert.equal(bravoBusiness.id, bravo.businessId);
  assert.notEqual(alphaBusiness.name, bravoBusiness.name);
});

test("one business cannot read another's lead by id", async () => {
  const created = await call(alpha, "/api/v1/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Alpha Secret Lead", phone: "+353870000001", summary: "Confidential" }),
  });
  assert.equal(created.status, 201);
  const lead = created.body.lead as { id: string };

  const asOwner = await call(alpha, `/api/v1/leads/${lead.id}`);
  assert.equal(asOwner.status, 200, "the owner should be able to read their own lead");

  const asOutsider = await call(bravo, `/api/v1/leads/${lead.id}`);
  assert.equal(asOutsider.status, 404, "another business must not be able to read it");
});

test("one business cannot edit or delete another's lead", async () => {
  const created = await call(alpha, "/api/v1/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Alpha Lead Two", phone: "+353870000002" }),
  });
  const lead = created.body.lead as { id: string };

  const edit = await call(bravo, `/api/v1/leads/${lead.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Hijacked" }),
  });
  assert.equal(edit.status, 404);

  const remove = await call(bravo, `/api/v1/leads/${lead.id}`, { method: "DELETE" });
  assert.equal(remove.status, 404);

  const check = await call(alpha, `/api/v1/leads/${lead.id}`);
  assert.equal(check.status, 200);
  assert.equal((check.body.lead as { name: string }).name, "Alpha Lead Two");
});

test("lead lists never leak across tenants", async () => {
  await call(alpha, "/api/v1/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Alpha Only", phone: "+353870000003" }),
  });

  const bravoLeads = await call(bravo, "/api/v1/leads");
  assert.equal(bravoLeads.status, 200);

  const items = bravoLeads.body.items as { name: string | null }[];
  assert.ok(!items.some((lead) => lead.name?.startsWith("Alpha")), "bravo must not see alpha's leads");
});

test("one business cannot reconfigure another's AI receptionist", async () => {
  const alphaAgents = await call(alpha, "/api/v1/agents");
  const agent = (alphaAgents.body.agents as { id: string }[])[0];
  assert.ok(agent, "signup should provision a receptionist");

  const read = await call(bravo, `/api/v1/agents/${agent.id}`);
  assert.equal(read.status, 404);

  const write = await call(bravo, `/api/v1/agents/${agent.id}`, {
    method: "PATCH",
    body: JSON.stringify({ greeting: "You have reached the wrong business entirely." }),
  });
  assert.equal(write.status, 404);

  const stillIntact = await call(alpha, `/api/v1/agents/${agent.id}`);
  assert.notEqual(
    (stillIntact.body.agent as { greeting: string }).greeting,
    "You have reached the wrong business entirely."
  );
});

test("a phone number can only belong to one workspace", async () => {
  const number = `+3538700${Math.floor(Math.random() * 90000 + 10000)}`;

  const first = await call(alpha, "/api/v1/phone-numbers", {
    method: "POST",
    body: JSON.stringify({ e164: number, label: "Alpha line" }),
  });
  assert.equal(first.status, 201);

  const second = await call(bravo, "/api/v1/phone-numbers", {
    method: "POST",
    body: JSON.stringify({ e164: number, label: "Bravo tries to steal it" }),
  });
  assert.equal(second.status, 409, "claiming a number another tenant owns must conflict");
});

test("appointments cannot be double-booked", async () => {
  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  startsAt.setUTCHours(10, 0, 0, 0);

  const first = await call(alpha, "/api/v1/appointments", {
    method: "POST",
    body: JSON.stringify({ title: "First booking", startsAt: startsAt.toISOString(), customerName: "Test One" }),
  });
  assert.equal(first.status, 201);

  const clash = await call(alpha, "/api/v1/appointments", {
    method: "POST",
    body: JSON.stringify({ title: "Clashing booking", startsAt: startsAt.toISOString(), customerName: "Test Two" }),
  });
  assert.equal(clash.status, 409, "an overlapping appointment must be refused");
});

test("another tenant's appointment slot is not blocked", async () => {
  const startsAt = new Date(Date.now() + 31 * 24 * 60 * 60_000);
  startsAt.setUTCHours(11, 0, 0, 0);

  const alphaBooking = await call(alpha, "/api/v1/appointments", {
    method: "POST",
    body: JSON.stringify({ title: "Alpha slot", startsAt: startsAt.toISOString(), customerName: "A" }),
  });
  assert.equal(alphaBooking.status, 201);

  const bravoBooking = await call(bravo, "/api/v1/appointments", {
    method: "POST",
    body: JSON.stringify({ title: "Bravo slot", startsAt: startsAt.toISOString(), customerName: "B" }),
  });
  assert.equal(bravoBooking.status, 201, "calendars must be per-tenant, not global");
});

test("the platform admin panel is invisible to a customer", async () => {
  for (const path of ["/api/admin/overview", "/api/admin/businesses", "/api/admin/demo-requests"]) {
    const { status } = await call(alpha, path);
    assert.equal(status, 404, `${path} returned ${status} to a customer`);
  }
});

test("an unsigned Twilio webhook is rejected", async () => {
  const response = await fetch(`${BASE}/api/webhooks/twilio/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ CallSid: "CAfake", From: "+353871111111", To: "+353871111112" }),
  });
  assert.equal(response.status, 403, "an unsigned call webhook must not be trusted");
});

test("an unsigned Stripe webhook is rejected", async () => {
  const response = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "customer.subscription.updated", data: { object: {} } }),
  });
  assert.ok(response.status === 400 || response.status === 403, `expected a rejection, got ${response.status}`);
});

test("invalid input is refused with a readable message", async () => {
  const { status, body } = await call(alpha, "/api/v1/leads", {
    method: "POST",
    body: JSON.stringify({ email: "definitely-not-an-email" }),
  });
  assert.equal(status, 400);
  assert.ok(typeof body.error === "string" && body.error.length > 0);
});

test("pagination is capped so one request cannot pull the whole table", async () => {
  const { status, body } = await call(alpha, "/api/v1/leads?pageSize=100000");
  assert.equal(status, 200);
  assert.ok((body.pageSize as number) <= 100, `pageSize was ${body.pageSize}`);
});

test("a workspace a user does not belong to cannot be switched into", async () => {
  const { status } = await call(alpha, "/api/v1/workspaces", {
    method: "PATCH",
    body: JSON.stringify({ businessId: bravo.businessId }),
  });
  assert.equal(status, 403);
});

after(() => {
  console.log("\nE2E tenants used (safe to delete):");
  console.log(`  ${alpha?.email}`);
  console.log(`  ${bravo?.email}`);
});
