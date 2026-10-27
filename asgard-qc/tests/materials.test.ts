import { beforeEach, describe, expect, it } from "vitest";
import { acceptanceGaps, createMaterial, dispositionMaterial, listMaterials, updateMaterial, verifyCertificate } from "@/lib/services/materials";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("material traceability", () => {
  it("searches by heat number, grade and certificate", async () => {
    const mi = await makeActor("MATERIAL_INSPECTOR");
    await createMaterial(mi, { description: "RHS", grade: "S355J2H", heatNumber: "H-77423", certificateRef: "C-91" });
    await createMaterial(mi, { description: "Plate", grade: "S275JR", heatNumber: "H-11111" });
    expect((await listMaterials(mi, { q: "77423" })).map((m) => m.description)).toEqual(["RHS"]);
    expect(await listMaterials(mi, { q: "s275" })).toHaveLength(1);
    expect(await listMaterials(mi, { q: "C-91" })).toHaveLength(1);
    expect(await listMaterials(mi, { gapsOnly: true })).toHaveLength(2);
  });

  it("never accepts material just because a certificate reference was entered", async () => {
    const mi = await makeActor("MATERIAL_INSPECTOR");
    const m = await createMaterial(mi, { description: "RHS", grade: "S355", heatNumber: "H-1", certificateRef: "C-1", receivingResult: "PASS" });
    expect(m.certStatus).toBe("UPLOADED_UNVERIFIED");
    await expect(dispositionMaterial(mi, m.id, "ACCEPTED")).rejects.toThrow(/not yet verified/);
    await verifyCertificate(mi, m.id, true);
    const accepted = await dispositionMaterial(mi, m.id, "ACCEPTED");
    expect(accepted.status).toBe("ACCEPTED");
    // Changing the heat number afterwards resets verification and acceptance.
    const changed = await updateMaterial(mi, m.id, { heatNumber: "H-2" });
    expect(changed.certStatus).toBe("UPLOADED_UNVERIFIED");
    expect(changed.status).toBe("AWAITING_INSPECTION");
  });

  it("lists every gap and requires a reason to quarantine", async () => {
    const mi = await makeActor("MATERIAL_INSPECTOR");
    expect(acceptanceGaps({ heatNumber: null, grade: null, certStatus: "MISSING", receivingResult: "PENDING", identificationMismatch: true })).toHaveLength(5);
    const m = await createMaterial(mi, { description: "x" });
    await expect(dispositionMaterial(mi, m.id, "QUARANTINED")).rejects.toThrow(/reason/);
    expect((await dispositionMaterial(mi, m.id, "QUARANTINED", "Mismatch")).status).toBe("QUARANTINED");
    const qc = await makeActor("QC_INSPECTOR");
    await expect(dispositionMaterial(qc, m.id, "ACCEPTED")).rejects.toThrow(/permission/);
  });
});
