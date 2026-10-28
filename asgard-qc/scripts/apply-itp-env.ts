/** One-off ITP application during a hosted build (same audited path as
 *  Project → ITP upload), so the company ITP text stays out of the repository.
 *    ITP_APPLY     "<project number>|<discipline>|<document ref>"
 *    ITP_ROWS      control points separated by "~", fields by "|" in the order of
 *                  FIELDS below (plain ASCII, empty field = blank)
 *    ITP_SHA256    sha256 of ITP_ROWS; refuses to run if altered in transit.
 *  Several projects in one build: ITP_APPLY targets separated by ";" and one
 *  block of rows per target in ITP_ROWS, blocks separated by "^". For large
 *  payloads set ITP_ROWS_GZ (base64 of gzip of the same text) instead of
 *  ITP_ROWS; the checksum is of the uncompressed text.
 *  A discipline already applied to a project is reported and skipped. */
import type { ControlPointType } from "@prisma/client";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { db } from "../src/lib/db";
import type { ParsedControlPoint } from "../src/lib/import/itp";
import { applyParsedItp } from "../src/lib/services/itp";
import { actorFromUser } from "../src/lib/session";

const FIELDS = ["itemNo", "section", "activity", "acceptanceCriteria", "method", "frequency", "extent", "responsibility", "signoffDocument", "verifyingDocument", "subPoint", "pointType", "clientPoint", "thirdPartyPoint"] as const;

function parsePoints(block: string) {
  return block.split("~").map((line) => {
    const v = line.split("|");
    if (v.length !== FIELDS.length) throw new Error(`ITP row has ${v.length} fields, expected ${FIELDS.length}: ${line.slice(0, 60)}`);
    const p = Object.fromEntries(FIELDS.map((f, i) => [f, v[i] === "" ? null : v[i]])) as unknown as ParsedControlPoint;
    p.pointType = (p.pointType as ControlPointType | null) ?? null;
    if (!p.itemNo || !p.activity) throw new Error(`ITP row missing item number or activity: ${line.slice(0, 60)}`);
    return p;
  });
}

async function main() {
  const targets = process.env.ITP_APPLY?.trim();
  const gz = process.env.ITP_ROWS_GZ?.trim();
  const raw = gz ? gunzipSync(Buffer.from(gz, "base64")).toString("utf8") : process.env.ITP_ROWS;
  if (!targets || !raw?.trim()) return console.log("ITP_APPLY / ITP_ROWS not set — no ITP applied.");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== process.env.ITP_SHA256?.trim()) throw new Error(`ITP payload checksum mismatch (got ${sha}). Nothing applied.`);
  const list = targets.split(";").map((t) => t.trim()).filter(Boolean);
  const blocks = raw.split("^");
  if (blocks.length !== list.length) throw new Error(`${list.length} ITP targets but ${blocks.length} row blocks. Nothing applied.`);
  // Validate every block before touching the database.
  const parsed = list.map((t, i) => {
    const [code, discipline, documentRef] = t.split("|").map((s) => s.trim());
    return { code: code.toUpperCase(), discipline, documentRef: documentRef || null, points: parsePoints(blocks[i]) };
  });
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  for (const t of parsed) {
    const project = await db.project.findUnique({ where: { code: t.code }, select: { id: true } });
    if (!project) {
      console.log(`ITP not applied: project ${t.code} not found.`);
      continue;
    }
    try {
      const result = await applyParsedItp(actor, project.id, [{ discipline: t.discipline, documentRef: t.documentRef, points: t.points, warnings: [] }], "QF 6.14 (build import)");
      console.log("ITP applied:", JSON.stringify({ project: t.code, result }));
    } catch (e) {
      // Already applied: report and carry on rather than failing the deploy.
      console.log(`ITP not applied to ${t.code}:`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
