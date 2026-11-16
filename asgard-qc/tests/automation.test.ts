import { beforeEach, describe, expect, it } from "vitest";
import { automationActivity, weeklyDigest } from "@/lib/automation";
import { db } from "@/lib/db";
import { createInspection, submitInspection } from "@/lib/services/inspections";
import { addAction, moveNcr, updateActionStatus, updateNcr } from "@/lib/services/ncrs";
import { runNotificationScan } from "@/lib/services/notifications";
import { createProject } from "@/lib/services/projects";
import { updateSetting } from "@/lib/services/settings";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { makeActor, resetDb } from "./helpers";

const DAY = 86_400_000;

describe("quality automation", () => {
  beforeEach(resetDb);

  it("raises one linked NCR when a failed inspection is submitted, and none for a pass, an import or when switched off", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qm, { name: "Auto" });
    const fail = (extra = {}) => createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", result: "FAIL", inspectedAt: new Date(), items: [{ description: "Length", requirement: "2000 ±2", actual: "2006", result: "FAIL" }, { description: "Square", requirement: "±1", result: "PASS" }], ...extra });

    const r = await submitInspection(qc, (await fail()).id);
    expect(r.autoNcr?.code).toMatch(/^NCR-/);
    const ncr = await db.ncr.findUniqueOrThrow({ where: { id: r.autoNcr!.id } });
    expect(ncr).toMatchObject({ inspectionId: r.id, status: "OPEN", defectCategory: "Dimensional", projectId: p.id });
    expect(ncr.description).toMatch(/Length \(required: 2000 ±2\) — found: 2006/);
    expect(ncr.description).not.toMatch(/Square/);
    expect(ncr.raisedByName).toMatch(/raised automatically/);
    expect(await db.auditEvent.count({ where: { action: "automation.ncr_raised", entityId: ncr.id } })).toBe(1);
    expect(await db.notification.count({ where: { kind: "AUTO_NCR_RAISED", userId: qm.id } })).toBe(1);

    const pass = await createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", result: "PASS", inspectedAt: new Date() });
    expect((await submitInspection(qc, pass.id)).autoNcr).toBeNull();
    expect((await submitInspection(qc, (await fail()).id, { automation: false })).autoNcr).toBeNull();
    await updateSetting(await makeActor("ADMIN"), "automation", { ...SETTING_DEFAULTS.automation, autoNcrOnFailedInspection: false });
    expect((await submitInspection(qc, (await fail()).id)).autoNcr).toBeNull();
    expect(await db.ncr.count()).toBe(1);
    // The automatic notification survives the condition scan.
    await runNotificationScan();
    expect(await db.notification.count({ where: { kind: "AUTO_NCR_RAISED", resolvedAt: null } })).toBe(1);
  });

  it("plans one re-inspection with the failed checks when the NCR reaches awaiting verification; it decides nothing", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qm, { name: "Re" });
    const insp = await createInspection(qc, { projectId: p.id, type: "WELD_VISUAL", result: "FAIL", inspectedAt: new Date(), items: [{ description: "Weld 4", requirement: "No undercut", result: "FAIL" }, { description: "Weld 5", requirement: "No undercut", result: "PASS" }] });
    const { autoNcr } = await submitInspection(qc, insp.id);
    const id = autoNcr!.id;
    await updateNcr(qm, id, { rootCause: "Travel speed", rootCauseCategory: "Method / procedure" });
    await moveNcr(qm, id, "INVESTIGATING");
    await moveNcr(qm, id, "ACTION_IN_PROGRESS");
    const a = await addAction(qm, { ncrId: id, description: "Repair weld 4", ownerName: "Welder" });
    await updateActionStatus(qm, a.id, "COMPLETED");
    const moved = await moveNcr(qm, id, "AWAITING_VERIFICATION");
    expect(moved.reinspection?.code).toMatch(/^INS-/);
    const re = await db.inspection.findUniqueOrThrow({ where: { id: moved.reinspection!.id }, include: { items: true } });
    expect(re).toMatchObject({ status: "DRAFT", result: "PENDING", reinspectionOfId: insp.id, type: "WELD_VISUAL", inspectorId: null });
    expect(re.items.map((i) => [i.description, i.result])).toEqual([["Weld 4", "PENDING"]]);
    expect(re.plannedDate!.getTime()).toBeGreaterThan(Date.now() + DAY);
    expect((await db.ncr.findUniqueOrThrow({ where: { id } })).status).toBe("AWAITING_VERIFICATION");
    // Going back and forward again does not plan a second one.
    await moveNcr(qm, id, "ACTION_IN_PROGRESS");
    expect((await moveNcr(qm, id, "AWAITING_VERIFICATION")).reinspection).toBeNull();
    expect(await db.inspection.count({ where: { reinspectionOfId: insp.id } })).toBe(1);
  });

  it("escalates a High alert nobody acknowledged, once, and leaves the alert unchanged", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qm, { name: "Esc" });
    await updateSetting(await makeActor("ADMIN"), "automation", { ...SETTING_DEFAULTS.automation, autoNcrOnFailedInspection: false });
    const i = await createInspection(qc, { projectId: p.id, type: "DIMENSIONAL", result: "FAIL", inspectedAt: new Date(Date.now() - 10 * DAY) });
    await submitInspection(qc, i.id);
    expect((await runNotificationScan()).escalated).toBe(0);
    const alert = await db.qualityAlert.findFirstOrThrow({ where: { ruleKey: "FAILED_INSPECTION_NO_NCR" } });
    await db.qualityAlert.update({ where: { id: alert.id }, data: { firstRaisedAt: new Date(Date.now() - 4 * DAY) } });
    expect((await runNotificationScan()).escalated).toBe(1);
    expect((await runNotificationScan()).escalated).toBe(0);
    expect(await db.notification.count({ where: { kind: "ALERT_ESCALATION", userId: qm.id, resolvedAt: null } })).toBe(1);
    expect(await db.notification.count({ where: { kind: "ALERT_ESCALATION", userId: qc.id } })).toBe(0);
    expect((await db.qualityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("NEW");
  });

  it("writes the weekly summary only with Monday's 09:00 review, once", async () => {
    const admin = await makeActor("ADMIN");
    const now = new Date();
    expect(await weeklyDigest(now, { date: "2026-11-17", time: "09:00" })).toBeNull(); // Tuesday
    expect(await weeklyDigest(now, { date: "2026-11-16", time: "12:00" })).toBeNull();
    expect(await weeklyDigest(now, { date: "2026-11-16", time: "09:00" })).toMatchObject({ recipients: 1, email: "not sent" });
    expect(await weeklyDigest(now, { date: "2026-11-16", time: "09:00" })).toBeNull();
    const n = await db.notification.findFirstOrThrow({ where: { kind: "WEEKLY_DIGEST", userId: admin.id } });
    expect(n.body).toMatch(/Inspections: 0/);
    expect((await automationActivity()).counts["automation.weekly_digest"]).toBe(1);
  });
});
