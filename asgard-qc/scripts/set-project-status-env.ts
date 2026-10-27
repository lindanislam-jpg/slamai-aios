/** One-off status changes during a hosted build.
 *    PROJECT_STATUS_UPDATES  "AMM770=ACTIVE,AMM856=ACTIVE,..." (project number = status)
 *  Each change goes through updateProject as the first administrator, so it is
 *  validated and written to the audit trail. Unknown numbers are reported, not created. */
import type { ProjectStatus } from "@prisma/client";
import { db } from "../src/lib/db";
import { updateProject } from "../src/lib/services/projects";
import { actorFromUser } from "../src/lib/session";

const STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_RELEASE", "CLOSED", "CANCELLED"];

async function main() {
  const raw = process.env.PROJECT_STATUS_UPDATES?.trim();
  if (!raw) return console.log("PROJECT_STATUS_UPDATES not set — no status changes.");
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator found.");
  const actor = await actorFromUser(admin);
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
