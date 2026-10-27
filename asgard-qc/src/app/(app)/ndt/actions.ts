"use server";

import { run, type ActionState } from "@/lib/action";
import { saveCoating, saveNdt } from "@/lib/services/ndt-coating";
import { formToObject } from "@/lib/validation";

export async function saveNdtAction(id: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const r = await saveNdt(actor, id, formToObject(fd) as Parameters<typeof saveNdt>[2]);
    return id ? { message: `${r.code} updated.`, redirect: "/ndt" } : `${r.code} recorded.`;
  }, ["/ndt", "/welding"]);
}

export async function saveCoatingAction(id: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const r = await saveCoating(actor, id, formToObject(fd) as Parameters<typeof saveCoating>[2]);
    return id ? { message: `${r.code} updated.`, redirect: "/coating" } : `${r.code} recorded.`;
  }, ["/coating"]);
}
