import { NextResponse } from "next/server";
import { suggestForPhoto } from "@/lib/ai/vision";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiActor("photo.edit");
    const { id } = await params;
    const suggestion = await suggestForPhoto(actor, id);
    return NextResponse.json({ suggestion });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
