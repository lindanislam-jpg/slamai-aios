import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { registerUploadedPhoto, type PhotoMeta } from "@/lib/services/photos";

export const runtime = "nodejs";

/** POST JSON { projectId, key, fileName, ...photo metadata } after a browser-direct upload. */
export async function POST(req: Request) {
  try {
    const actor = await requireApiActor("photo.upload");
    const { projectId, key, fileName, ...meta } = (await req.json()) as Record<string, string>;
    const result = await registerUploadedPhoto(actor, String(projectId ?? ""), String(key ?? ""), String(fileName ?? ""), meta as unknown as PhotoMeta);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
