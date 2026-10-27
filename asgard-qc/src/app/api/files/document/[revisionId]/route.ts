import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, publicMessage } from "@/lib/errors";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ revisionId: string }> }) {
  try {
    const actor = await requireApiActor("records.view");
    const { revisionId } = await params;
    const rev = await db.documentRevision.findUnique({ where: { id: revisionId }, include: { document: { select: { docNo: true } } } });
    if (!rev || !rev.storageKey) return NextResponse.json({ error: "No file for this revision." }, { status: 404 });
    const data = await storage().get(rev.storageKey);
    await db.auditEvent.create({ data: { actorId: actor.id, actorName: actor.name, action: "document.download", entityType: "Document", entityId: rev.documentId, summary: `${rev.document.docNo} rev ${rev.revision} downloaded` } });
    const safeName = (rev.fileName ?? `${rev.document.docNo}-rev${rev.revision}`).replace(/[^\w.\- ]+/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": rev.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
