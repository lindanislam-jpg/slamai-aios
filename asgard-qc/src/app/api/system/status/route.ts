import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, publicMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight poll target so open dashboards refresh after each review. */
export async function GET() {
  try {
    await requireApiActor("records.view");
    const latest = await db.systemCheckRun.findFirst({ where: { status: { not: "MISSED" } }, orderBy: { startedAt: "desc" }, select: { id: true, status: true, finishedAt: true } });
    return NextResponse.json({ latest }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
