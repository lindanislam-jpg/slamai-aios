import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { addRevision } from "@/lib/services/documents";

export const runtime = "nodejs";

/** POST multipart: revision, notes, file (optional — reference-only allowed). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("document.write");
    const { id } = await params;
    const fd = await req.formData();
    const file = fd.get("file");
    const upload = file instanceof File && file.size > 0 ? { name: file.name, data: Buffer.from(await file.arrayBuffer()) } : null;
    const rev = await addRevision(actor, id, { revision: String(fd.get("revision") ?? ""), notes: (fd.get("notes") as string) || null }, upload);
    return NextResponse.json({ ok: true, id: rev.id, revision: rev.revision });
  } catch (err) {
    return NextResponse.json({ ok: false, error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
