import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, publicMessage } from "@/lib/errors";
import { photoUploadKeyBelongsTo } from "@/lib/services/photos";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Short-lived tokens for browser-direct photo uploads to the private Vercel
 *  Blob store (phone photos often exceed the 4.5 MB function request limit).
 *  Each token allows exactly one key under an existing project. */
export async function POST(req: Request) {
  try {
    const actor = await requireApiActor("photo.upload");
    if (storage().driver !== "vercel-blob") throw new AppError("Direct upload is not available with this storage driver.", 400);
    const limits = await getSetting("uploadLimits");
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const projectId = /^photo-uploads\/([^/]+)\//.exec(pathname)?.[1] ?? "";
        if (!projectId || !photoUploadKeyBelongsTo(pathname, projectId)) throw new AppError("Invalid upload path.", 400);
        if (!(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw new AppError("Project not found.", 404);
        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: limits.maxFileMb * 1_048_576,
          validUntil: Date.now() + 30 * 60_000,
          tokenPayload: actor.id,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 400 });
  }
}
