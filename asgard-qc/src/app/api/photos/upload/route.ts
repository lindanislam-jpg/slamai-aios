import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/auth";
import { AppError, publicMessage } from "@/lib/errors";
import { uploadPhotos, type PhotoMeta } from "@/lib/services/photos";

export const runtime = "nodejs";

const META_KEYS = [
  "unitId", "componentRef", "stage", "category", "inspectionType", "responsiblePerson", "heatNumber", "weldRef",
  "inspectionId", "ncrId", "weldId", "materialId", "repairId", "reworkPhase", "caption", "description",
  "observedCondition", "correctiveAction", "tags",
] as const;

export async function POST(req: Request) {
  try {
    const actor = await requireApiActor("photo.upload");
    const fd = await req.formData();
    const projectId = String(fd.get("projectId") ?? "");
    if (!projectId) return NextResponse.json({ error: "Choose a project." }, { status: 422 });
    const meta: Record<string, string> = {};
    for (const k of META_KEYS) {
      const v = fd.get(k);
      if (typeof v === "string") meta[k] = v;
    }
    const files = [];
    for (const f of fd.getAll("files")) {
      if (typeof f === "string") continue;
      files.push({ name: f.name, data: Buffer.from(await f.arrayBuffer()) });
    }
    const results = await uploadPhotos(actor, projectId, files, meta as unknown as PhotoMeta);
    return NextResponse.json({ results });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 500;
    return NextResponse.json({ error: publicMessage(err) }, { status });
  }
}
