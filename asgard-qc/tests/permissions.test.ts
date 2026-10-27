import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, permissionsFor } from "@/lib/permissions";

describe("role permissions", () => {
  it("viewers and auditors cannot change quality records", () => {
    for (const role of ["PRODUCTION_VIEWER", "AUDITOR"] as const) {
      const p = permissionsFor(role);
      for (const perm of ["inspection.write", "ncr.close", "release.approve", "material.disposition", "photo.upload"] as const) expect(p.has(perm)).toBe(false);
      expect(p.has("records.view")).toBe(true);
    }
  });

  it("only quality managers and admins can close NCRs or approve release by default", () => {
    const holders = Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(([, ps]) => ps.includes("ncr.close") && ps.includes("release.approve")).map(([r]) => r).sort();
    expect(holders).toEqual(["ADMIN", "QUALITY_MANAGER"]);
  });

  it("applies overrides but never lets an admin lose user/settings management", () => {
    const p = permissionsFor("ADMIN", { ADMIN: ["records.view"] });
    expect(p.has("users.manage")).toBe(true);
    expect(p.has("settings.manage")).toBe(true);
    expect(p.has("ncr.close")).toBe(false);
    const q = permissionsFor("QC_INSPECTOR", { QC_INSPECTOR: ["records.view", "photo.upload", "bogus.perm" as never] });
    expect([...q].sort()).toEqual(["photo.upload", "records.view"]);
  });
});
