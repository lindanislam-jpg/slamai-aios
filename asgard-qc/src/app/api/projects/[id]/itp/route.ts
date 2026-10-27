import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { applyItp } from "@/lib/services/itp";

/** POST multipart: file (ITP .xlsx) + optional repeated `discipline`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("project.write");
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Choose the ITP Excel file (.xlsx).", 422);
    if (file.size > 20 * 1_048_576) throw new AppError("ITP file is larger than 20 MB.", 422);
    const disciplines = form.getAll("discipline").map(String).filter(Boolean);
    const result = await applyItp(actor, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) }, disciplines);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 500;
    return NextResponse.json({ ok: false, error: publicMessage(err) }, { status });
  }
}
