import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/audit";
import { AppError, publicMessage } from "@/lib/errors";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("records.view");
    const { id } = await params;
    const a = await db.cmrAttachment.findUnique({ where: { id }, include: { cmr: { select: { code: true } } } });
    if (!a) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const data = await storage().get(a.storageKey);
    await recordEvent(db, actor, "cmr.download", "Cmr", a.cmrId, { summary: `${a.cmr.code}: ${a.fileName} downloaded` });
    const safeName = a.fileName.replace(/[^\w.\- ()]+/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
