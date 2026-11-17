import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createProject } from "@/lib/services/projects";
import { disciplineName, importPacks, listPacks, markPackReturned, packCounts, recordPack } from "@/lib/services/quality-packs";
import { makeActor, resetDb } from "./helpers";

describe("quality packs", () => {
  beforeEach(resetDb);

  it("names disciplines from the SharePoint folder names", () => {
    expect(disciplineName("2. Structural Inspections")).toBe("Structural");
    expect(disciplineName("5. Electrical Inspections")).toBe("Electrical");
    expect(disciplineName("Painting")).toBe("Painting");
  });

  it("imports the SharePoint listing once, refreshes file lists, never invents dates, and counts returned vs issued", async () => {
    const admin = await makeActor("ADMIN");
    const p = await createProject(admin, { name: "Skids", code: "AMM602" });
    const base = { project: "amm602", discipline: "Structural" };
    const items = [
      { ...base, stage: "RETURNED" as const, name: "Admin Skid", kind: "folder" as const, fileCount: 2, files: ["a.pdf", "b.xlsx"], sourcePath: "X/2. Returned/Admin Skid" },
      { ...base, stage: "ISSUED" as const, name: "Number 1 Paint QC Pack.pdf", kind: "file" as const, sourcePath: "X/1. Issued/Number 1 Paint QC Pack.pdf" },
      { ...base, project: "AMM999", stage: "ISSUED" as const, name: "x", kind: "file" as const, sourcePath: "Y/x" },
    ];
    const r1 = await importPacks(admin, items);
    expect(r1).toMatchObject({ created: 2, failed: 1, missingProjects: ["AMM999"] });
    const r2 = await importPacks(admin, [{ ...items[0], fileCount: 3, files: ["a.pdf", "b.xlsx", "c.pdf"] }, items[1]]);
    expect(r2).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
    const rows = await listPacks({ projectId: p.id });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.returnedAt === null && r.issuedAt === null)).toBe(true);
    expect((await listPacks({ stage: "RETURNED" }))[0]).toMatchObject({ name: "Admin Skid", fileCount: 3 });
    expect(await packCounts()).toMatchObject([{ returned: 1, issued: 1, byDiscipline: { Structural: { returned: 1, issued: 1 } } }]);
    expect(await packCounts({ stage: "RETURNED" })).toMatchObject([{ returned: 1, issued: 0 }]);
  });

  it("records a pack by hand and marks an issued pack returned, with an audit trail; viewers cannot", async () => {
    const qc = await makeActor("QC_INSPECTOR", "Inspector One");
    const p = await createProject(await makeActor("ADMIN"), { name: "Kiosk" });
    const pk = await recordPack(qc, { projectId: p.id, discipline: "Electrical", name: "Kiosk 3 electrical pack", stage: "ISSUED", date: "2026-11-01" });
    expect(pk).toMatchObject({ code: expect.stringMatching(/^QP-/), stage: "ISSUED", createdByName: "Inspector One" });
    const back = await markPackReturned(qc, pk.id, { date: "2026-11-10", returnedByName: "Shop floor" });
    expect(back).toMatchObject({ stage: "RETURNED", returnedByName: "Shop floor" });
    expect(back.returnedAt?.toISOString().slice(0, 10)).toBe("2026-11-10");
    await expect(markPackReturned(qc, pk.id, {})).rejects.toThrow(/already returned/);
    expect(await db.auditEvent.count({ where: { entityId: pk.id } })).toBe(2);
    await expect(recordPack(await makeActor("AUDITOR"), { projectId: p.id, discipline: "Electrical", name: "x", stage: "ISSUED" })).rejects.toThrow();
  });
});
