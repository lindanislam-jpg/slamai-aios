import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadRules } from "@/lib/services/alert-rules";
import { listAlerts, moveAlert, updateRule } from "@/lib/services/alerts";
import { addCmrAttachment, moveCmr, raiseCmr, reopenCmr, updateCmrWork } from "@/lib/services/cmrs";
import { createEquipment, updateEquipment } from "@/lib/services/documents";
import { createInspection } from "@/lib/services/inspections";
import { createMaterial } from "@/lib/services/materials";
import { runNotificationScan } from "@/lib/services/notifications";
import { createProject } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

const DAY = 86_400_000;

async function workedCmr() {
  const qm = await makeActor("QUALITY_MANAGER", "Quinn Manager");
  const tech = await makeActor("MAINTENANCE_TECHNICIAN", "Terry Tech");
  const sup = await makeActor("PRODUCTION_SUPERVISOR");
  const eq = await createEquipment(qm, { assetNo: "SAW-01", description: "Band saw", equipmentType: "Saw" });
  const c = await raiseCmr(sup, { equipmentId: eq.id, problem: "Blade guide worn", priority: "HIGH", equipmentUnavailable: true });
  return { qm, tech, sup, eq, c };
}

describe("CMR workflow", () => {
  it("runs raise → assign → work → verify → close, marks the asset out of service and back only on verification", async () => {
    const { qm, tech, eq, c } = await workedCmr();
    expect(c.code).toBe("CMR-0001");
    expect((await db.equipment.findUniqueOrThrow({ where: { id: eq.id } })).status).toBe("OUT_OF_SERVICE");

    await moveCmr(tech, c.id, { status: "ASSIGNED", assignedToName: "Terry Tech" });
    await moveCmr(tech, c.id, { status: "IN_PROGRESS" });
    await expect(moveCmr(tech, c.id, { status: "AWAITING_VERIFICATION" })).rejects.toThrow(/work carried out/);
    await updateCmrWork(tech, c.id, { diagnosis: "Guide bearing seized", workDone: "Replaced guide bearing", partsUsed: "Bearing 6202", downtimeHours: 3.5 });
    await moveCmr(tech, c.id, { status: "AWAITING_VERIFICATION" });

    // Technicians cannot verify; the person who did the work cannot verify.
    await expect(moveCmr(tech, c.id, { status: "COMPLETED", note: "ok" })).rejects.toThrow();
    const sameName = await makeActor("QUALITY_MANAGER", "Terry Tech");
    await expect(moveCmr(sameName, c.id, { status: "COMPLETED", note: "ok" })).rejects.toThrow(/cannot verify/);
    await expect(moveCmr(qm, c.id, { status: "COMPLETED" })).rejects.toThrow(/verification/);

    await moveCmr(qm, c.id, { status: "COMPLETED", note: "Test cut 10 pieces, square within drawing tolerance", returnToService: true });
    expect((await db.equipment.findUniqueOrThrow({ where: { id: eq.id } })).status).toBe("IN_SERVICE");
    const closed = await moveCmr(qm, c.id, { status: "CLOSED" });
    expect(closed.closedAt).not.toBeNull();
    expect(await db.auditEvent.count({ where: { entityType: "Cmr", entityId: c.id } })).toBeGreaterThanOrEqual(6);
  });

  it("rejects invalid transitions, requires a cancel reason, and keeps history when reopened", async () => {
    const { qm, tech, c } = await workedCmr();
    await expect(moveCmr(tech, c.id, { status: "CLOSED" })).rejects.toThrow();
    await expect(moveCmr(tech, c.id, { status: "IN_PROGRESS" })).rejects.toThrow(/cannot move/);
    await expect(moveCmr(tech, c.id, { status: "CANCELLED" })).rejects.toThrow(/reason/);
    await moveCmr(tech, c.id, { status: "ASSIGNED", assignedToName: "Terry Tech" });
    await moveCmr(tech, c.id, { status: "IN_PROGRESS" });
    await updateCmrWork(tech, c.id, { workDone: "Adjusted guide" });
    await moveCmr(tech, c.id, { status: "AWAITING_VERIFICATION" });
    await moveCmr(qm, c.id, { status: "COMPLETED", note: "Checked" });
    await moveCmr(qm, c.id, { status: "CLOSED" });
    await expect(updateCmrWork(tech, c.id, { workDone: "more" })).rejects.toThrow(/reopen/);

    const r = await reopenCmr(tech, c.id, "Guide noise returned");
    expect(r.status).toBe("SUBMITTED");
    expect(r.reopenCount).toBe(1);
    expect(r.verifiedByName).toBeNull();
    const hist = r.closureHistory as { verifiedByName: string; workDone: string; reopenReason: string }[];
    expect(hist[0]).toMatchObject({ verifiedByName: qm.name, workDone: "Adjusted guide", reopenReason: "Guide noise returned" });
  });

  it("enforces permissions and validates attachments", async () => {
    const viewer = await makeActor("PRODUCTION_VIEWER");
    const { c, tech } = await workedCmr();
    await expect(raiseCmr(viewer, { assetLabel: "x", problem: "y" })).rejects.toThrow();
    await expect(raiseCmr(tech, { problem: "no asset" })).rejects.toThrow(/equipment/);
    await expect(addCmrAttachment(tech, c.id, { name: "a.exe", data: Buffer.from("MZ") })).rejects.toThrow(/not allowed/);
    const a = await addCmrAttachment(tech, c.id, { name: "fault.pdf", data: Buffer.from("%PDF-1.4 x") }, "Before");
    expect(a.storageKey).toMatch(/^cmr\//);
    await expect(addCmrAttachment(tech, c.id, { name: "again.pdf", data: Buffer.from("%PDF-1.4 x") })).rejects.toThrow(/already/);
  });

  it("does not let the equipment form return an asset with open CMRs to service", async () => {
    const { qm, eq } = await workedCmr();
    await expect(updateEquipment(qm, eq.id, { status: "IN_SERVICE" })).rejects.toThrow(/CMR verification/);
  });
});

describe("Smart Quality Alerts", () => {
  it("raises a repeated-fault alert with evidence once threshold is met, without duplicates", async () => {
    const { sup, eq } = await workedCmr();
    await runNotificationScan();
    expect(await db.qualityAlert.count({ where: { ruleKey: "CMR_REPEAT_FAULT" } })).toBe(0);
    await raiseCmr(sup, { equipmentId: eq.id, problem: "Blade guide worn again" });
    await runNotificationScan();
    await runNotificationScan();
    const alerts = await db.qualityAlert.findMany({ where: { ruleKey: "CMR_REPEAT_FAULT" } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("HIGH");
    expect((alerts[0].evidence as { ref: string }[]).map((e) => e.ref).sort()).toEqual(["CMR-0001", "CMR-0002"]);
    expect(await db.qualityAlert.count({ where: { ruleKey: "EQUIPMENT_UNAVAILABLE" } })).toBe(1);
  });

  it("flags overdue CMRs, missing heat numbers and failed inspections without NCR", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "Alerts" });
    await raiseCmr(qm, { assetLabel: "Overhead crane", problem: "Pendant fault", requestedBy: new Date(Date.now() - DAY) });
    await createMaterial(qm, { projectId: p.id, description: "SHS 100x100x5" });
    await createInspection(qm, { projectId: p.id, type: "DIMENSIONAL", result: "FAIL", inspectedAt: new Date(Date.now() - 5 * DAY) });
    await runNotificationScan();
    const keys = (await db.qualityAlert.findMany()).map((a) => a.ruleKey);
    expect(keys).toEqual(expect.arrayContaining(["CMR_OVERDUE", "MATERIAL_HEAT_MISSING", "FAILED_INSPECTION_NO_NCR"]));
  });

  it("auto-resolves when the condition clears and reopens when it returns; dismissal needs a reason", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "Heat" });
    const m = await createMaterial(qm, { projectId: p.id, description: "Plate 10mm" });
    await runNotificationScan();
    const a = await db.qualityAlert.findFirstOrThrow({ where: { ruleKey: "MATERIAL_HEAT_MISSING" } });
    await expect(moveAlert(qm, a.id, { status: "DISMISSED" })).rejects.toThrow(/reason/);
    await moveAlert(qm, a.id, { status: "ASSIGNED", assignedToName: "Stores" });

    await db.material.update({ where: { id: m.id }, data: { heatNumber: "H123" } });
    await runNotificationScan();
    const resolved = await db.qualityAlert.findUniqueOrThrow({ where: { id: a.id } });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedByName).toMatch(/System/);

    await db.material.update({ where: { id: m.id }, data: { heatNumber: null } });
    await runNotificationScan();
    const back = await db.qualityAlert.findUniqueOrThrow({ where: { id: a.id } });
    expect(back.status).toBe("NEW");
    expect(back.reopenCount).toBe(1);
    expect(await db.qualityAlert.count({ where: { ruleKey: "MATERIAL_HEAT_MISSING" } })).toBe(1);
  });

  it("keeps a person's resolution while the condition persists", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const p = await createProject(qm, { name: "Persist" });
    await createMaterial(qm, { projectId: p.id, description: "Angle" });
    await runNotificationScan();
    const a = await db.qualityAlert.findFirstOrThrow({ where: { ruleKey: "MATERIAL_HEAT_MISSING" } });
    await expect(moveAlert(qm, a.id, { status: "RESOLVED" })).rejects.toThrow(/how/);
    await moveAlert(qm, a.id, { status: "RESOLVED", note: "Heat number requested from supplier" });
    await runNotificationScan();
    expect((await db.qualityAlert.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("RESOLVED");
    expect((await listAlerts(qm, { status: "open" })).map((x) => x.ruleKey)).not.toContain("MATERIAL_HEAT_MISSING");
    expect((await listAlerts(qm, { status: "open" })).map((x) => x.ruleKey)).toContain("CERT_MISSING");
  });

  it("lets only administrators change rules, versions each change, and honours disabled rules and thresholds", async () => {
    const admin = await makeActor("ADMIN");
    const qm = await makeActor("QUALITY_MANAGER");
    await loadRules();
    await expect(updateRule(qm, "CMR_REPEAT_FAULT", { enabled: "on", severity: "HIGH", params: { threshold: 3, windowDays: 90 } })).rejects.toThrow();
    await expect(updateRule(admin, "CMR_REPEAT_FAULT", { enabled: "on", severity: "HIGH", params: { threshold: -1, windowDays: 90 } })).rejects.toThrow(/whole number/);
    const r = await updateRule(admin, "CMR_REPEAT_FAULT", { enabled: "on", severity: "CRITICAL", params: { threshold: 3, windowDays: 90 } });
    expect(r.version).toBe(2);
    expect(await db.auditEvent.count({ where: { action: "alert.rule" } })).toBe(1);

    const sup = await makeActor("PRODUCTION_SUPERVISOR");
    const eq = await createEquipment(admin, { assetNo: "WLD-02", description: "MIG set" });
    await raiseCmr(sup, { equipmentId: eq.id, problem: "Wire feed slips" });
    await raiseCmr(sup, { equipmentId: eq.id, problem: "Wire feed slips again" });
    await runNotificationScan();
    expect(await db.qualityAlert.count({ where: { ruleKey: "CMR_REPEAT_FAULT" } })).toBe(0); // threshold now 3

    await updateRule(admin, "CMR_OVERDUE", { enabled: false, severity: "HIGH", params: { criticalDays: 1, highDays: 3, mediumDays: 7, lowDays: 14 } });
    await raiseCmr(sup, { equipmentId: eq.id, problem: "Third", requestedBy: new Date(Date.now() - DAY) });
    await runNotificationScan();
    expect(await db.qualityAlert.count({ where: { ruleKey: "CMR_OVERDUE" } })).toBe(0);
    const repeat = await db.qualityAlert.findFirstOrThrow({ where: { ruleKey: "CMR_REPEAT_FAULT" } });
    expect(repeat.severity).toBe("CRITICAL");
    expect(repeat.ruleVersion).toBe(2);
  });
});
