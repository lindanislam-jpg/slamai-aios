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
    const f = await db.projectFile.findUnique({ where: { id } });
    if (!f) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const data = await storage().get(f.storageKey);
    await recordEvent(db, actor, "file.download", "ProjectFile", f.id, { summary: `${f.code} ${f.fileName} downloaded` });
    const safeName = f.fileName.replace(/[^\w.\- ()]+/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        // Always a download, never rendered in the app's origin.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
