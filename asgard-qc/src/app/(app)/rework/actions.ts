"use server";

import type { InspectionResult } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { recordRework, reinspectRework } from "@/lib/services/ncrs";

export async function recordReworkAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const r = await recordRework(actor, formToObject(fd) as Parameters<typeof recordRework>[1]);
    return `${r.code} recorded — awaiting re-inspection.`;
  }, ["/rework"]);
}

export async function reinspectAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const result = String(fd.get("result")) as InspectionResult;
    await reinspectRework(actor, id, result, (fd.get("notes") as string) || null);
    return `Re-inspection recorded: ${result.toLowerCase()}.`;
  }, ["/rework"]);
}
