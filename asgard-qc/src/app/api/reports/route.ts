import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { REPORT_TYPES, type ReportType } from "@/lib/report/data";
import { generateReport } from "@/lib/report/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

const toDate = (v: unknown, end = false) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v.length === 10 ? `${v}T${end ? "23:59:59.999" : "00:00:00"}Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function POST(req: Request) {
  try {
    const actor = await requireApiActor("report.generate");
    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "") as ReportType;
    if (!(type in REPORT_TYPES)) return NextResponse.json({ error: "Unknown report type." }, { status: 422 });
    if (typeof body.projectId !== "string" || !body.projectId) return NextResponse.json({ error: "Choose a project." }, { status: 422 });
    const job = await generateReport(actor, {
      type,
      projectId: body.projectId,
      unitId: typeof body.unitId === "string" && body.unitId ? body.unitId : null,
      from: toDate(body.from),
      to: toDate(body.to, true),
    });
    return NextResponse.json({ id: job.id, code: job.code, revision: job.revision });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
