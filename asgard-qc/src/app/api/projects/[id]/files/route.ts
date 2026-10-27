import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { uploadProjectFiles } from "@/lib/services/files";

export const runtime = "nodejs";

/** POST multipart: repeated `files` + category, unitId, notes. Used where the
 *  storage driver cannot take browser-direct uploads (local disk, S3, Netlify). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("file.upload");
    const { id } = await params;
    const fd = await req.formData();
    const files = [];
    for (const f of fd.getAll("files")) {
      if (typeof f === "string") continue;
      files.push({ name: f.name, data: Buffer.from(await f.arrayBuffer()) });
    }
    const meta = { category: String(fd.get("category") ?? ""), unitId: String(fd.get("unitId") ?? ""), notes: String(fd.get("notes") ?? "") };
    const results = await uploadProjectFiles(actor, id, files, meta as never);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
