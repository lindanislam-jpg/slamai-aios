import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { addCmrAttachment } from "@/lib/services/cmrs";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("cmr.raise");
    const { id } = await params;
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    const row = await addCmrAttachment(actor, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) }, (fd.get("caption") as string) || null);
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
