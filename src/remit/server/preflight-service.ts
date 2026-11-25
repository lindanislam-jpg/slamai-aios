import "server-only";
import { db } from "@/lib/db";
import {
  checkEnvironment,
  summarise,
  type ConfigCheck,
  type PreflightReport,
} from "../config/preflight";

/**
 * Preflight with the database included.
 *
 * Split from the pure checks so the environment logic stays testable without a
 * database, and so a page can render the environment part even when the
 * database is the thing that is down.
 */

export async function checkDatabase(): Promise<ConfigCheck[]> {
  if (!process.env.DATABASE_URL) {
    // Already reported by the environment check; don't repeat it as a
    // connection failure, which would send the operator down the wrong path.
    return [];
  }

  try {
    const corridors = await db.remitCorridor.count({ where: { isActive: true } });
    const feeRules = await db.remitFeeRule.count({ where: { isActive: true } });

    const checks: ConfigCheck[] = [
      { name: "Database", status: "ok", detail: "Connected.", required: true },
    ];

    if (corridors === 0) {
      checks.push({
        name: "Reference data",
        status: "error",
        detail:
          "No active corridors. The schema is present but unseeded — run " +
          "`npm run db:push` then `npm run db:seed:remit` against this database.",
        required: true,
      });
    } else if (feeRules === 0) {
      checks.push({
        name: "Fee rules",
        status: "error",
        detail:
          "No active fee rule. Quoting fails closed without one — seed the " +
          "database or create a rule in admin.",
        required: true,
      });
    } else {
      checks.push({
        name: "Reference data",
        status: "ok",
        detail: `${corridors} active corridor(s), ${feeRules} active fee rule(s).`,
        required: true,
      });
    }

    return checks;
  } catch (error) {
    // The message can name a host, so it is deliberately not returned to the
    // client — only logged. The client gets the actionable summary.
    console.error("[remit:preflight] database check failed:", error);
    return [
      {
        name: "Database",
        status: "error",
        detail:
          "Could not connect. Check DATABASE_URL points at a reachable Postgres " +
          "instance and that the schema has been pushed.",
        required: true,
      },
    ];
  }
}

export async function runPreflight(): Promise<PreflightReport> {
  const checks = [...checkEnvironment(), ...(await checkDatabase())];
  return summarise(checks);
}
