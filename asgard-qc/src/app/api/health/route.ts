import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness check for monitoring. Reports only up/down. */
export async function GET() {
  let dbOk = false;
  let storageOk = false;
  let driver = "unknown";
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    /* reported as error */
  }
  try {
    const s = storage();
    driver = s.driver;
    const key = `health/check-${process.pid}.txt`;
    await s.put(key, Buffer.from(new Date().toISOString()), "text/plain");
    storageOk = await s.exists(key);
    await s.remove(key);
  } catch {
    /* reported as error */
  }
  const ok = dbOk && storageOk;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db: dbOk ? "ok" : "error", storage: { driver, writable: storageOk }, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
