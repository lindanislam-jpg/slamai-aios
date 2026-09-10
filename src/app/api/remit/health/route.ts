import { NextResponse } from "next/server";
import { runPreflight } from "@/remit/server/preflight-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/remit/health
 *
 * Deployment diagnostics. Reports whether each piece of required
 * configuration is present and whether the database is reachable and seeded.
 *
 * It never reports a value — only a status and what to do about it — so it is
 * safe to leave reachable. A 503 when something required is missing also makes
 * it usable as a platform health check.
 */
export async function GET(): Promise<NextResponse> {
  const report = await runPreflight();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
