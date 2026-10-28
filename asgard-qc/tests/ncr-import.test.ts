import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createInspection } from "@/lib/services/inspections";
import { runNotificationScan } from "@/lib/services/notifications";
import { createProject } from "@/lib/services/projects";
import { applyNcrImport } from "../scripts/import-ncrs-env";
import { makeActor, resetDb } from "./helpers";

const DAY = 86_400_000;

describe("historical NCR import", () => {
  beforeEach(resetDb);

  it("transcribes paper NCRs, raises new ones only where none exist, links them to the failed inspection and is safe to re-run", async () => {
    const admin = await makeActor("ADMIN");
    const p = await createProject(admin, { code: "T1", name: "Test" });
    const src = (n: number) => `Quality/T1/insp-${n}.pdf`;
    for (const n of [1, 2]) {
      await createInspection(admin, { projectId: p.id, type: "FABRICATION", result: "FAIL", inspectorName: "HB", inspectedAt: new Date(Date.now() - 30 * DAY), comments: `x\nSource: SharePoint ${src(n)}` });
    }
    expect((await runNotificationScan()).conditionList.filter((c) => c.kind === "FAILED_INSPECTION_NO_NCR")).toHaveLength(2);

    const entries = [
      { project: "T1", mode: "transcribe" as const, inspectionSource: src(1), paperRef: "CAPA 2026 #3", register: "2026 CAPA log", raisedAt: "2026-05-02", description: "Missing welds on skid 3", defectCategory: "Welding", status: "CLOSED" as const, closedAt: "2026-05-10", closedByName: "H Bambrick" },
      { project: "T1", mode: "raise" as const, inspectionSource: src(2), description: "Bore undersize", defectCategory: "Dimensional" },
      { project: "T1", mode: "raise" as const, inspectionSource: "missing.pdf", description: "x", defectCategory: "Other" },
    ];
    expect(await applyNcrImport(admin, entries)).toEqual({ transcribed: 1, raised: 1, skipped: 0, failed: 1 });

    const ncrs = await db.ncr.findMany({ orderBy: { code: "asc" }, include: { inspection: true } });
    expect(ncrs.map((n) => [n.status, n.relatedCodes, n.inspection?.comments?.includes(src(1)) || n.inspection?.comments?.includes(src(2))])).toEqual([
      ["CLOSED", ["CAPA 2026 #3"], true],
      ["OPEN", [], true],
    ]);
    expect(ncrs[0].description).toMatch(/paper record remains the controlling document/);
    expect(ncrs[1].description).toMatch(/Raised retrospectively/);
    expect(await db.auditEvent.count({ where: { action: { in: ["ncr.transcribe", "ncr.raise"] } } })).toBe(2);

    expect(await applyNcrImport(admin, entries)).toEqual({ transcribed: 0, raised: 0, skipped: 2, failed: 1 });
    expect(await db.ncr.count()).toBe(2);
    expect((await runNotificationScan()).conditionList.filter((c) => c.kind === "FAILED_INSPECTION_NO_NCR")).toHaveLength(0);
  });
});
