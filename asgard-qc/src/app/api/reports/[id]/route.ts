import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, publicMessage } from "@/lib/errors";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiActor("report.generate");
    const { id } = await params;
    const job = await db.reportJob.findUnique({ where: { id }, include: { project: { select: { code: true } } } });
    if (!job || job.status !== "COMPLETED" || !job.storageKey) return new NextResponse("Not found", { status: 404 });
    const data = await storage().get(job.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${job.code}-${job.project.code}-${job.reportType.toLowerCase()}-rev${job.revision}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
