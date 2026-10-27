import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, publicMessage } from "@/lib/errors";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Streams evidence to signed-in users. Thumbnails need records.view; the
 *  original file needs photo.download. Withdrawn photos are only visible to
 *  reviewers. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const thumb = new URL(req.url).searchParams.get("size") === "thumb";
    const actor = await requireApiActor(thumb ? "records.view" : "photo.download");
    const photo = await db.photo.findUnique({ where: { id } });
    if (!photo || (photo.deletedAt && !actor.permissions.has("photo.review"))) return new NextResponse("Not found", { status: 404 });
    const key = thumb ? photo.thumbKey : photo.storageKey;
    if (!key) return new NextResponse("No preview available", { status: 404 });
    const data = await storage().get(key);
    const safeName = photo.originalName.replace(/[^\w.\- ]+/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": thumb ? "image/jpeg" : photo.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": thumb ? "inline" : `attachment; filename="${photo.code}-${safeName}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
