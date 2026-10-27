/** One-off ITP application during a hosted build (same audited path as
 *  Project → ITP upload), so the company ITP text stays out of the repository.
 *    ITP_APPLY     "<project number>|<discipline>|<document ref>"
 *    ITP_ROWS      control points separated by "~", fields by "|" in the order of
 *                  FIELDS below (plain ASCII, empty field = blank)
 *    ITP_SHA256    sha256 of ITP_ROWS; refuses to run if altered in transit.
 *  Refuses if that discipline is already applied to the project. */
import type { ControlPointType } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import type { ParsedControlPoint } from "../src/lib/import/itp";
import { applyParsedItp } from "../src/lib/services/itp";
import { actorFromUser } from "../src/lib/session";

const FIELDS = ["itemNo", "section", "activity", "acceptanceCriteria", "method", "frequency", "extent", "responsibility", "signoffDocument", "verifyingDocument", "subPoint", "pointType", "clientPoint", "thirdPartyPoint"] as const;

async function main() {
  const target = process.env.ITP_APPLY?.trim();
  const raw = process.env.ITP_ROWS;
  if (!target || !raw) return console.log("ITP_APPLY / ITP_ROWS not set — no ITP applied.");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.ITP_SHA256) throw new Error(`ITP payload checksum mismatch (got ${sha}). Nothing applied.`);
  const [code, discipline, documentRef] = target.split("|").map((s) => s.trim());
  const project = await db.project.findUnique({ where: { code: code.toUpperCase() }, select: { id: true } });
  if (!project) throw new Error(`Project ${code} not found.`);
  const points = raw.split("~").map((line) => {
    const v = line.split("|");
    if (v.length !== FIELDS.length) throw new Error(`ITP row has ${v.length} fields, expected ${FIELDS.length}: ${line.slice(0, 60)}`);
    const p = Object.fromEntries(FIELDS.map((f, i) => [f, v[i] === "" ? null : v[i]])) as unknown as ParsedControlPoint;
    p.pointType = (p.pointType as ControlPointType | null) ?? null;
    if (!p.itemNo || !p.activity) throw new Error(`ITP row missing item number or activity: ${line.slice(0, 60)}`);
    return p;
  });
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  try {
    const result = await applyParsedItp(await actorFromUser(admin), project.id, [{ discipline, documentRef: documentRef || null, points, warnings: [] }], "QF 6.14 (build import)");
    console.log("ITP applied:", JSON.stringify({ project: code, result }));
  } catch (e) {
    // Already applied: report and carry on rather than failing the deploy.
    console.log("ITP not applied:", e instanceof Error ? e.message : e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
