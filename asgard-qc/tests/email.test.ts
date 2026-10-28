import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runManual } from "@/lib/monitor/run";
import { updateSetting } from "@/lib/services/settings";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { makeActor, resetDb } from "./helpers";

const M365 = { M365_TENANT_ID: "tenant", M365_CLIENT_ID: "client", M365_CLIENT_SECRET: "secret-value", M365_SENDER: "quality@example.com" };
const emailLog = (r: { notifications: unknown }) => (r.notifications as { channel: string; outcome: string }[]).find((n) => n.channel === "email")!;

describe("review emails through Microsoft 365", () => {
  beforeEach(resetDb);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends nothing when not configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await runManual(await makeActor("ADMIN"));
    expect(emailLog(r).outcome).toBe("not configured — nothing sent");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stays off until an administrator turns it on, then reports acceptance, never delivery", async () => {
    for (const [k, v] of Object.entries(M365)) vi.stubEnv(k, v);
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      if (url.includes("/oauth2/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      return new Response(null, { status: 202 });
    }));
    const admin = await makeActor("ADMIN");
    expect(emailLog(await runManual(admin)).outcome).toMatch(/turned off/);
    expect(calls).toHaveLength(0);

    await updateSetting(admin, "systemMonitor", { ...SETTING_DEFAULTS.systemMonitor, notifyOn: "every", emailReports: true });
    const log = emailLog(await runManual(admin));
    expect(log.outcome).toMatch(/accepted by Microsoft 365 for 1 recipient\(s\) — delivery not confirmed/);
    const send = calls.find((c) => c.url.includes("/sendMail"))!;
    expect(send.url).toContain("/users/quality%40example.com/sendMail");
    expect(JSON.parse(send.body).message.toRecipients).toEqual([{ emailAddress: { address: admin.email.toLowerCase() } }]);
    expect(send.body).not.toContain("secret-value");
  });

  it("records a provider rejection without claiming anything was sent", async () => {
    for (const [k, v] of Object.entries(M365)) vi.stubEnv(k, v);
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("/oauth2/") ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }) : new Response(JSON.stringify({ error: { code: "ErrorAccessDenied" } }), { status: 403 })));
    const admin = await makeActor("ADMIN");
    await updateSetting(admin, "systemMonitor", { ...SETTING_DEFAULTS.systemMonitor, notifyOn: "every", emailReports: true });
    expect(emailLog(await runManual(admin)).outcome).toBe("rejected by Microsoft 365 (403 ErrorAccessDenied) — nothing sent");
  });
});
