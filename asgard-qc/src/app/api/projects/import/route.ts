import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { importProjects, projectImportTemplate } from "@/lib/import/projects";

/** GET: download the blank import template. */
export async function GET() {
  try {
    await requireApiActor("project.write");
    const buf = await projectImportTemplate();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="asgard-project-import-template.xlsx"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}

/** POST multipart: file + mode=preview|apply. */
export async function POST(req: Request) {
  try {
    const actor = await requireApiActor("project.write");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Choose the Excel file to import.", 422);
    if (file.size > 10 * 1_048_576) throw new AppError("Import file is larger than 10 MB.", 422);
    const apply = form.get("mode") === "apply";
    const result = await importProjects(actor, Buffer.from(await file.arrayBuffer()), apply);
    return NextResponse.json({ ok: true, applied: apply, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: publicMessage(err) }, { status: err instanceof AppError ? err.status : 500 });
  }
}
