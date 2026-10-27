import { NextResponse, type NextRequest } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { globalSearch } from "@/lib/services/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiActor("records.view");
    const hits = await globalSearch(actor, (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100));
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
