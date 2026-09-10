/**
 * One-command setup for the money-transfer module.
 *
 *   npm run setup:remit
 *
 * Or against a remote database (Vercel Postgres, Neon, Supabase):
 *
 *   DATABASE_URL="postgresql://..." npm run setup:remit
 *
 * It pushes the schema, seeds the reference data, then reports exactly what is
 * still missing. Everything it does is idempotent — running it twice is safe.
 *
 * This replaces the previous three-step dance (db:push, db:seed:remit, then
 * guess why the app is still empty), which was where deployments got stuck.
 */
import { execSync } from "node:child_process";

/**
 * Snapshot the real environment BEFORE anything loads a .env file into it.
 *
 * Importing `@prisma/client` reads .env into process.env as a side effect. Without
 * this snapshot the script would report "NEXTAUTH_SECRET is set" when it is set
 * only in a local .env and NOT in the deployed environment — precisely the
 * confusion this script exists to prevent. `@prisma/client` is therefore imported
 * dynamically, after this line.
 */
const SHELL_ENV = { ...process.env };

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const ok = (message: string) => console.log(`${GREEN}  ✓${RESET} ${message}`);
const warn = (message: string) => console.log(`${YELLOW}  !${RESET} ${message}`);
const fail = (message: string) => console.log(`${RED}  ✗${RESET} ${message}`);
const step = (message: string) => console.log(`\n${BOLD}${message}${RESET}`);

/** Redact everything but the host, so a log or screenshot leaks nothing. */
function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/** Where a value actually came from — the shell, or a local .env file. */
function source(name: string): string {
  return SHELL_ENV[name] ? `${DIM}(from the environment)${RESET}` : `${DIM}(from .env)${RESET}`;
}

async function main() {
  console.log(`${BOLD}Money-transfer module setup${RESET}`);

  // Importing this loads .env into process.env as a side effect. Done here,
  // after SHELL_ENV is captured, so values are USED (local work needs .env) but
  // their origin is still reportable.
  const { PrismaClient } = await import("@prisma/client");

  // --- 1. Environment -------------------------------------------------------
  step("1. Checking environment");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("DATABASE_URL is not set.");
    console.log(
      `${DIM}    Add it to .env for local work, or pass it inline:\n` +
        `    DATABASE_URL="postgresql://..." npm run setup:remit${RESET}`,
    );
    process.exit(1);
  }
  ok(`DATABASE_URL points at ${describeDatabase(databaseUrl)} ${source("DATABASE_URL")}`);

  if (!process.env.DIRECT_URL) {
    warn("DIRECT_URL is not set — falling back to DATABASE_URL for migrations.");
    process.env.DIRECT_URL = databaseUrl;
  }

  // Checked but never fixed here: generating an auth secret for someone and
  // printing it to a terminal is how a secret ends up in a scrollback buffer,
  // a CI log or a screenshot. The operator generates their own.
  const hasAuthSecret = Boolean(process.env.NEXTAUTH_SECRET);
  if (hasAuthSecret) {
    ok(`NEXTAUTH_SECRET is set ${source("NEXTAUTH_SECRET")}`);
    if (!SHELL_ENV.NEXTAUTH_SECRET) {
      warn(
        "That value comes from your local .env — it says nothing about whether " +
          "your deployment has one. Check /api/remit/health on the deployment itself.",
      );
    }
  } else {
    warn("NEXTAUTH_SECRET is not set (see the summary below).");
  }

  // --- 2. Schema ------------------------------------------------------------
  step("2. Pushing the database schema");
  try {
    execSync("npx prisma db push --skip-generate --accept-data-loss=false", {
      stdio: "inherit",
      env: process.env,
    });
    ok("Schema is in sync.");
  } catch {
    fail("Could not push the schema. Is DATABASE_URL reachable from here?");
    process.exit(1);
  }

  // --- 3. Reference data ----------------------------------------------------
  step("3. Seeding reference data");
  try {
    execSync("npx tsx prisma/remit-seed.ts", { stdio: "inherit", env: process.env });
  } catch {
    fail("Seeding failed.");
    process.exit(1);
  }

  // --- 4. Verify ------------------------------------------------------------
  step("4. Verifying");
  const db = new PrismaClient();
  try {
    const [corridors, feeRules, customers, admins] = await Promise.all([
      db.remitCorridor.count({ where: { isActive: true } }),
      db.remitFeeRule.count({ where: { isActive: true } }),
      db.remitCustomer.count(),
      db.remitAdmin.count(),
    ]);

    if (corridors > 0) ok(`${corridors} active corridor(s).`);
    else fail("No active corridors — the app will have nothing to quote.");

    if (feeRules > 0) ok(`${feeRules} active fee rule(s).`);
    else fail("No active fee rule — quoting fails closed without one.");
    ok(`${customers} customer account(s), ${admins} admin(s).`);

    // --- Summary ------------------------------------------------------------
    const blockers: string[] = [];
    if (corridors === 0) blockers.push("no active corridor");
    if (feeRules === 0) blockers.push("no active fee rule");
    if (!hasAuthSecret) blockers.push("NEXTAUTH_SECRET not set");

    console.log(`\n${BOLD}${"─".repeat(60)}${RESET}`);
    if (blockers.length === 0) {
      console.log(`${GREEN}${BOLD}Database is ready.${RESET}`);
    } else {
      console.log(`${YELLOW}${BOLD}Database is ready. Still to do:${RESET}`);
      for (const blocker of blockers) console.log(`  • ${blocker}`);
    }

    console.log(`\n${BOLD}For a deployed environment, set these and redeploy:${RESET}`);
    console.log("  DATABASE_URL      the same connection string used here");
    console.log("  DIRECT_URL        the same again");
    console.log("  NEXTAUTH_SECRET   generate with: openssl rand -base64 32");
    console.log("  REMIT_DEMO_MODE   true, to enable the sandbox simulator");
    console.log(
      `${DIM}  On Vercel these are per-environment — tick Preview as well as\n` +
        `  Production — and a build that already exists does not pick them up,\n` +
        `  so redeploy afterwards.${RESET}`,
    );

    console.log(`\n${BOLD}Then check it:${RESET}`);
    console.log("  GET /api/remit/health    every check as JSON, 503 while anything is missing");
    console.log("  /send/setup              the same report as a page");
    console.log(`${BOLD}${"─".repeat(60)}${RESET}\n`);

    if (blockers.some((blocker) => blocker !== "NEXTAUTH_SECRET not set")) process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
