/** One-off project changes during a hosted build.
 *    PROJECT_STATUS_UPDATES  "AMM770=ACTIVE,AMM856=ACTIVE,..." (project number = status)
 *    PROJECT_FIELD_UPDATES   "AMM973|customerRef=Cental|startDate=2026-10-20~AMM972|..."
 *                            projects separated by "~", fields by "|" (see FIELDS).
 *                            "field?=value" fills the field only when it is empty,
 *                            so a value someone already entered is never replaced.
 *  Each change goes through updateProject as the first administrator, so it is
 *  validated and written to the audit trail. Unknown numbers are reported, not created. */
import type { ProjectStatus } from "@prisma/client";
import { db } from "../src/lib/db";
import { updateProject } from "../src/lib/services/projects";
import { actorFromUser } from "../src/lib/session";

const STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_RELEASE", "CLOSED", "CANCELLED"];
const FIELDS = ["customerRef", "startDate", "targetDate", "projectManager", "departments", "drawingRefs", "scope", "description", "requirements"];

async function fieldUpdates(actor: Awaited<ReturnType<typeof actorFromUser>>, raw: string) {
  const changed: string[] = [];
  const problems: string[] = [];
  for (const block of raw.split("~").map((s) => s.trim()).filter(Boolean)) {
    const [codeRaw, ...pairs] = block.split("|");
    const code = codeRaw.trim().toUpperCase();
    const p = await db.project.findUnique({ where: { code } });
    if (!p) {
      problems.push(`${code}: not found`);
      continue;
    }
    const data: Record<string, string> = {};
    for (const pair of pairs) {
      const i = pair.indexOf("=");
      const ifEmpty = pair.slice(0, i).trim().endsWith("?");
      const key = pair.slice(0, i).trim().replace(/\?$/, "");
      if (i < 1 || !FIELDS.includes(key)) problems.push(`${code}: unknown field in "${pair.slice(0, 40)}"`);
      else if (ifEmpty && (p as Record<string, unknown>)[key] != null && String((p as Record<string, unknown>)[key]).trim() !== "") problems.push(`${code}: ${key} already set — kept`);
      else data[key] = pair.slice(i + 1).trim();
    }
    if (Object.keys(data).length) {
      await updateProject(actor, p.id, data);
      changed.push(`${code}: ${Object.keys(data).join(", ")}`);
    }
  }
  console.log("Project field updates:", JSON.stringify({ changed, problems }));
}

async function main() {
  const raw = process.env.PROJECT_STATUS_UPDATES?.trim();
  const fields = process.env.PROJECT_FIELD_UPDATES?.trim();
  if (!raw && !fields) return console.log("No project status or field updates.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
  if (fields) await fieldUpdates(actor, fields);
  if (!raw) return;
  const changed: string[] = [];
  const unchanged: string[] = [];
  const problems: string[] = [];
  for (const pair of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [code, status] = pair.split("=").map((s) => s.trim().toUpperCase());
    if (!code || !STATUSES.includes(status)) {
      problems.push(`${pair}: expected NUMBER=${STATUSES.join("|")}`);
      continue;
    }
    const p = await db.project.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!p) problems.push(`${code}: not found`);
    else if (p.status === status) unchanged.push(code);
    else {
      await updateProject(actor, p.id, { status: status as ProjectStatus });
      changed.push(`${code} ${p.status}→${status}`);
    }
  }
  console.log("Project status updates:", JSON.stringify({ changed, unchanged, problems }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
