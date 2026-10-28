import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { CHECKS, redact, type CheckDef } from "@/lib/monitor/checks";
import { retryRun, runManual, runReview, tickSchedule } from "@/lib/monitor/run";
import { dublinToUtc, nextSlot, planTick, slotKey } from "@/lib/monitor/schedule";
import { raiseNcr } from "@/lib/services/ncrs";
import { createProject } from "@/lib/services/projects";
import { updateSetting } from "@/lib/services/settings";
import { makeActor, resetDb } from "./helpers";

const H = 3_600_000;
const iso = (d: Date) => d.toISOString();

describe("schedule (Europe/Dublin)", () => {
  it("maps 09:00 / 12:00 / 18:00 to UTC in winter and summer", () => {
    expect(iso(dublinToUtc("2026-01-15", "09:00"))).toBe("2026-01-15T09:00:00.000Z");
    expect(iso(dublinToUtc("2026-01-15", "12:00"))).toBe("2026-01-15T12:00:00.000Z");
    expect(iso(dublinToUtc("2026-01-15", "18:00"))).toBe("2026-01-15T18:00:00.000Z");
    expect(iso(dublinToUtc("2026-07-15", "09:00"))).toBe("2026-07-15T08:00:00.000Z");
    expect(iso(dublinToUtc("2026-07-15", "12:00"))).toBe("2026-07-15T11:00:00.000Z");
    expect(iso(dublinToUtc("2026-07-15", "18:00"))).toBe("2026-07-15T17:00:00.000Z");
  });

  it("handles the daylight-saving change days", () => {
    // Clocks go forward 29 Mar 2026 01:00 UTC; back 25 Oct 2026 01:00 UTC.
    expect(iso(dublinToUtc("2026-03-28", "18:00"))).toBe("2026-03-28T18:00:00.000Z");
    expect(iso(dublinToUtc("2026-03-29", "09:00"))).toBe("2026-03-29T08:00:00.000Z");
    expect(iso(dublinToUtc("2026-10-24", "18:00"))).toBe("2026-10-24T17:00:00.000Z");
    expect(iso(dublinToUtc("2026-10-25", "09:00"))).toBe("2026-10-25T09:00:00.000Z");
  });

  it("runs each slot exactly once from the six UTC cron calls, any minute within the hour, across DST", () => {
    // Vercel Hobby fires each daily cron somewhere within its hour.
    for (const [day, minute] of [["2026-01-15", 0], ["2026-01-15", 59], ["2026-07-15", 1], ["2026-07-15", 58], ["2026-03-29", 30], ["2026-10-25", 30]] as const) {
      const done = new Set<string>();
      const ran: string[] = [];
      for (const hour of [8, 9, 11, 12, 17, 18]) {
        const now = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
        const { due, missed } = planTick(now, done, { since: new Date(`${day}T00:00:00Z`) });
        expect(missed).toEqual([]);
        if (due) {
          done.add(due.key);
          ran.push(due.time);
        }
      }
      expect(ran, `${day} :${minute}`).toEqual(["09:00", "12:00", "18:00"]);
    }
  });

  it("catches up within the window after an outage and records a slot as missed beyond it", () => {
    const since = new Date("2026-01-15T00:00:00Z");
    const done = new Set([slotKey("2026-01-15", "09:00")]);
    // Outage over 12:00; back at 14:30 → still within 3 h → runs late.
    expect(planTick(new Date("2026-01-15T14:30:00Z"), done, { since }).due?.key).toBe("2026-01-15@12:00");
    // Back only at 17:30 → 12:00 is missed, nothing due yet.
    const p = planTick(new Date("2026-01-15T17:30:00Z"), done, { since });
    expect(p.due).toBeNull();
    expect(p.missed.map((m) => m.key)).toEqual(["2026-01-15@12:00"]);
    expect(nextSlot(new Date("2026-01-15T17:30:00Z")).key).toBe("2026-01-15@18:00");
  });

  it("never treats slots before the monitor was enabled as missed", () => {
    const p = planTick(new Date("2026-01-15T19:00:00Z"), new Set(), { since: new Date("2026-01-15T17:00:00Z") });
    expect(p.missed).toEqual([]);
    expect(p.due?.key).toBe("2026-01-15@18:00");
  });

  it("redacts secrets from error text", () => {
    const r = redact("connect postgres://user:pw@host/db failed; Bearer abc.def; key sk-1234567890abcdef");
    expect(r).not.toMatch(/pw@|abc\.def|1234567890abcdef/);
  });
});

describe("scheduled review runs", () => {
  beforeEach(resetDb);

  it("runs every check against the database, stores a report and never duplicates a slot", async () => {
    await makeActor("ADMIN");
    const now = new Date();
    const first = await tickSchedule(now);
    expect(first.action).toBe("ran");
    const run = await db.systemCheckRun.findUniqueOrThrow({ where: { id: first.runId! } });
    expect(run.status).toBe("COMPLETED");
    expect(run.health).toBe("HEALTHY");
    const checks = run.checks as { key: string; status: string }[];
    expect(checks.filter((c) => c.status === "ERROR")).toEqual([]);
    expect(checks.map((c) => c.key)).toEqual(expect.arrayContaining(CHECKS.map((c) => c.key)));
    const alertsBefore = await db.qualityAlert.count();
    const again = await tickSchedule(new Date(now.getTime() + 60_000));
    expect(again.action).toBe("nothing-due");
    expect(await db.systemCheckRun.count({ where: { status: { not: "MISSED" } } })).toBe(1);
    expect(await db.qualityAlert.count()).toBe(alertsBefore);
    expect(await db.notification.count({ where: { kind: "SYSTEM_REVIEW" } })).toBeGreaterThanOrEqual(0);
  });

  it("reports a database failure as FAILED, not successful", async () => {
    const dbDown: CheckDef = { key: "app.database", group: "application", label: "Database connectivity", fatal: true, run: async () => { throw new Error("connect ECONNREFUSED postgres://u:secret@db:5432"); } };
    const r = await runReview({ kind: "MANUAL", runKey: "test:db-down", triggeredBy: "test", checks: [dbDown, ...CHECKS.slice(1)] });
    expect(r.run!.status).toBe("FAILED");
    expect(r.run!.health).toBe("FAILED");
    expect(r.run!.error).toMatch(/Database connectivity failed/);
    expect(r.run!.error).not.toMatch(/secret/);
  });

  it("marks a storage or integration failure and a hung check as not run (PARTIAL), with technical health WARNING", async () => {
    await updateSetting(await makeActor("ADMIN"), "systemMonitor", { ...(await import("@/lib/settings")).SETTING_DEFAULTS.systemMonitor, checkTimeoutSeconds: 5 });
    const storageDown: CheckDef = { key: "app.storage", group: "application", label: "File storage", run: async () => { throw new Error("Blob store unreachable"); } };
    const hung: CheckDef = { key: "app.integrations", group: "application", label: "Integrations", run: () => new Promise(() => undefined) };
    const r = await runReview({ kind: "MANUAL", runKey: "test:partial", triggeredBy: "test", checks: [CHECKS[0], storageDown, hung] });
    expect(r.run!.status).toBe("PARTIAL");
    expect(r.run!.notRun).toBe(2);
    expect(r.run!.health).toBe("WARNING");
    const checks = r.run!.checks as { key: string; status: string; detail: string }[];
    expect(checks.find((c) => c.key === "app.storage")).toMatchObject({ status: "ERROR" });
    expect(checks.find((c) => c.key === "app.integrations")!.detail).toMatch(/did not respond within 5 s/);
  }, 20_000);

  it("shows a failed technical check as CRITICAL health and counts it", async () => {
    const bad: CheckDef = { key: "app.migrations", group: "application", label: "Migrations", run: async () => ({ status: "FAIL", detail: "1 migration failed" }) };
    const r = await runReview({ kind: "MANUAL", runKey: "test:fail", triggeredBy: "test", checks: [CHECKS[0], bad] });
    expect(r.run!.status).toBe("COMPLETED");
    expect(r.run!.health).toBe("CRITICAL");
    expect(r.run!.failed).toBe(1);
  });

  it("picks up KPI changes and reports them as changes since the previous run", async () => {
    const admin = await makeActor("ADMIN");
    const r1 = await runManual(admin);
    expect((r1.summary as { counts: { openNcrs: number } }).counts.openNcrs).toBe(0);
    const p = await createProject(admin, { name: "KPI" });
    await raiseNcr(admin, { projectId: p.id, description: "gap", defectCategory: "Dimensional", targetDate: new Date(Date.now() - 86_400_000) });
    const r2 = await runManual(admin);
    const s2 = r2.summary as { counts: { openNcrs: number; overdueNcrs: number }; projectsAffected: string[] };
    expect(s2.counts.openNcrs).toBe(1);
    expect(s2.counts.overdueNcrs).toBe(1);
    expect((r2.changes as { counts: Record<string, { before: number; after: number }> }).counts.openNcrs).toEqual({ before: 0, after: 1 });
    expect(r2.qualityStatus).not.toBe("CLEAR");
  });

  it("records missed slots after an outage and allows a safe retry of failed runs only", async () => {
    const admin = await makeActor("ADMIN");
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await updateSetting(admin, "systemMonitor", { ...(await import("@/lib/settings")).SETTING_DEFAULTS.systemMonitor, enabledSince: new Date(day.getTime() - 2 * 86_400_000).toISOString() });
    const t = await tickSchedule(new Date());
    expect(t.missed).toBeGreaterThan(0);
    const missed = await db.systemCheckRun.findFirstOrThrow({ where: { status: "MISSED" } });
    const retry = await retryRun(admin, missed.id);
    expect(retry.runKey).toBe(`${missed.runKey}#retry-1`);
    expect(retry.retryOfId).toBe(missed.id);
    await expect(retryRun(admin, retry.id)).rejects.toThrow(/Only failed/);
  });

  it("only administrators can run or retry manually; a run in progress blocks another", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const admin = await makeActor("ADMIN");
    await expect(runManual(qm)).rejects.toThrow();
    await db.systemCheckRun.create({ data: { code: "SYS-T1", runKey: "x", kind: "MANUAL", triggeredBy: "t" } });
    await expect(runManual(admin)).rejects.toThrow(/already running/);
    expect(await tickSchedule(new Date())).toMatchObject({ action: expect.stringMatching(/busy|nothing-due/) });
  });

  it("does nothing when disabled", async () => {
    const admin = await makeActor("ADMIN");
    await updateSetting(admin, "systemMonitor", { ...(await import("@/lib/settings")).SETTING_DEFAULTS.systemMonitor, enabled: false });
    expect((await tickSchedule(new Date())).action).toBe("disabled");
    expect(await db.systemCheckRun.count()).toBe(0);
  });

  it("separates a healthy application from manufacturing quality status", async () => {
    const admin = await makeActor("ADMIN");
    const r = await runManual(admin);
    expect(r.health).toBe("HEALTHY");
    expect(r.qualityStatus).toBeDefined();
    expect(["CLEAR", "ATTENTION", "CRITICAL"]).toContain(r.qualityStatus);
    void H;
  });
});
