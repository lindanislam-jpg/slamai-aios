import { NextResponse, type NextRequest } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { buildExport, EXPORTS, type ExportKind } from "@/lib/export/xlsx";
import { dateParam, periodRange, str, type SP } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in EXPORTS)) return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  try {
    const actor = await requireApiActor("export.excel");
    const sp: SP = Object.fromEntries(req.nextUrl.searchParams.entries());
    let from = dateParam(sp, "from");
    let to = dateParam(sp, "to", true);
    if (kind === "kpis" && !from && !to) {
      const r = periodRange(sp);
      from = r.from;
      to = r.to;
    }
    const { buffer, filename } = await buildExport(actor, kind as ExportKind, { projectId: str(sp, "projectId"), from, to });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
