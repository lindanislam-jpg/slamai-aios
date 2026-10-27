import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROJECT_FILE_MAX_MB } from "@/lib/domain/constants";
import { AppError, publicMessage } from "@/lib/errors";
import { checkFileName, keyBelongsToProject } from "@/lib/services/files";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Issues short-lived tokens so the browser can upload straight to the private
 *  Vercel Blob store (avoids the 4.5 MB function request limit). The token only
 *  allows the exact key requested, which must sit under this project. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("file.upload");
    const { id } = await params;
    if (storage().driver !== "vercel-blob") throw new AppError("Direct upload is not available with this storage driver.", 400);
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await db.project.findUnique({ where: { id }, select: { id: true } }))) throw new AppError("Project not found.", 404);
        if (!keyBelongsToProject(pathname, id)) throw new AppError("Invalid upload path.", 400);
        checkFileName(pathname);
        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: PROJECT_FILE_MAX_MB * 1_048_576,
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
