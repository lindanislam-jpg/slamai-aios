import { NextResponse } from "next/server";
import { redact } from "@/lib/monitor/checks";
import { tickSchedule } from "@/lib/monitor/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by Vercel Cron (vercel.json) at 08, 09, 11, 12, 17 and 18 UTC so
 * 09:00, 12:00 and 18:00 Europe/Dublin are covered in winter and summer.
 * Only ever runs the slot that is due, once (unique run key) — repeated or
 * unexpected calls do nothing. If CRON_SECRET is set, Vercel sends it and it
 * is required.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const by = req.headers.get("user-agent")?.includes("vercel-cron") ? "Vercel Cron" : "scheduler endpoint";
    const r = await tickSchedule(new Date(), by);
    // One line per call so the hosting logs show whether the schedule fired.
    console.log(`scheduled review tick (${by}):`, JSON.stringify(r));
    return NextResponse.json(r);
  } catch (e) {
    console.error("scheduled review tick failed", e);
    return NextResponse.json({ error: redact(e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
