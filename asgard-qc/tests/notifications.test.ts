import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runNotificationScan } from "@/lib/services/notifications";
import { createProject } from "@/lib/services/projects";
import { closeNcr, moveNcr, raiseNcr, updateNcr } from "@/lib/services/ncrs";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("notifications", () => {
  it("notifies the right roles once per condition and resolves when the condition clears", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    const viewer = await makeActor("PRODUCTION_VIEWER");
    const p = await createProject(qm, { name: "x" });
    const n = await raiseNcr(qm, { projectId: p.id, description: "late", defectCategory: "Dimensional", targetDate: new Date(Date.now() - 86_400_000) });
    await runNotificationScan();
    await runNotificationScan();
    const qmNotes = await db.notification.findMany({ where: { userId: qm.id, kind: "NCR_OVERDUE" } });
    expect(qmNotes).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: viewer.id } })).toBe(0);

    await moveNcr(qm, n.id, "INVESTIGATING");
    await updateNcr(qm, n.id, { rootCause: "x", disposition: "Use as is (concession)" });
    await moveNcr(qm, n.id, "ACTION_IN_PROGRESS");
    await moveNcr(qm, n.id, "AWAITING_VERIFICATION");
    await closeNcr(qm, n.id, { verificationNotes: "ok", reinspectionResult: "NA" });
    await runNotificationScan();
    const after = await db.notification.findFirstOrThrow({ where: { userId: qm.id, kind: "NCR_OVERDUE" } });
    expect(after.resolvedAt).not.toBeNull();
  });

  it("respects muted notification kinds", async () => {
    const qm = await makeActor("QUALITY_MANAGER");
    await db.user.update({ where: { id: qm.id }, data: { notificationPrefs: { muted: ["NCR_OVERDUE"] } } });
    const p = await createProject(qm, { name: "x" });
    await raiseNcr(qm, { projectId: p.id, description: "late", defectCategory: "Dimensional", targetDate: new Date(Date.now() - 86_400_000) });
    await runNotificationScan();
    expect(await db.notification.count({ where: { userId: qm.id, kind: "NCR_OVERDUE" } })).toBe(0);
  });
});
