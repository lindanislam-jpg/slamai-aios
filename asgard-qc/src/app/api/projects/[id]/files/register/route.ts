import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { registerUploadedFile } from "@/lib/services/files";

export const runtime = "nodejs";

/** POST JSON { key, fileName, category, unitId?, notes? } after a browser-direct upload. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("file.upload");
    const { id } = await params;
    const b = (await req.json()) as Record<string, unknown>;
    const row = await registerUploadedFile(actor, id, {
      key: String(b.key ?? ""),
      fileName: String(b.fileName ?? ""),
      category: String(b.category ?? "") as never,
      unitId: typeof b.unitId === "string" ? b.unitId : null,
      notes: typeof b.notes === "string" ? b.notes : null,
    });
    return NextResponse.json({ ok: true, id: row.id, code: row.code });
  } catch (err) {
    return NextResponse.json({ ok: false, error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
