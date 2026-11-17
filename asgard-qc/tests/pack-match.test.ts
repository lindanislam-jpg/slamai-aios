import { describe, expect, it } from "vitest";
import { buildPackIndex, matchPackFile } from "@/lib/pack-match";

const base = "4.0 - Contract Docs/4.2 Current/0.2 - Large Projects";
const packs = [
  { id: "admin", kind: "folder", sourcePath: `${base}/AMM602 HEL04 Skids/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/2. Returned/Admin Skid` },
  { id: "n1-issued", kind: "file", sourcePath: `${base}/AMM602 HEL04 Skids/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/1. Issued/Number 1.pdf` },
  { id: "n1-other", kind: "file", sourcePath: `${base}/AMM867-MAD 22050 Skids (Capital)/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/1. Issued/Number 1.pdf` },
  { id: "record", kind: "record", sourcePath: null },
];
const idx = buildPackIndex(packs);
const id = (m: ReturnType<typeof matchPackFile>) => (m && "pack" in m ? m.pack.id : m);

describe("matching picked files to quality packs", () => {
  it("matches files picked from the Large Projects folder by path, including files inside a pack folder", () => {
    expect(id(matchPackFile(idx, "0.2 - Large Projects/AMM602 HEL04 Skids/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/2. Returned/Admin Skid/sub/Skid A.pdf"))).toBe("admin");
    expect(id(matchPackFile(idx, "0.2 - Large Projects/AMM602 HEL04 Skids/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/1. Issued/Number 1.pdf"))).toBe("n1-issued");
    expect(id(matchPackFile(idx, "0.2 - Large Projects/AMM867-MAD 22050 Skids (Capital)/5. Manufacture & Quality/3. In Process Inspections/2. Structural Inspections/1. Issued/Number 1.pdf"))).toBe("n1-other");
  });

  it("ignores small differences in spaces, case and punctuation, and works from a project folder or the pack folder itself", () => {
    expect(id(matchPackFile(idx, "AMM602 HEL04 Skids/5. Manufacture & Quality/3. In-Process Inspections/2. structural inspections/2. Returned/Admin  Skid/x.pdf"))).toBe("admin");
    expect(id(matchPackFile(idx, "Admin Skid/Skid A.pdf"))).toBe("admin");
  });

  it("leaves a file alone when two packs fit or none does", () => {
    expect(matchPackFile(idx, "1. Issued/Number 1.pdf")).toEqual({ ambiguous: 2 });
    expect(matchPackFile(idx, "Number 1.pdf")).toEqual({ ambiguous: 2 });
    expect(matchPackFile(idx, "Somewhere/else.pdf")).toBeNull();
  });
});
