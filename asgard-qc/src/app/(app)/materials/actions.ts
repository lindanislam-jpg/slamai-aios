"use server";

import type { MaterialStatus } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { createMaterial, dispositionMaterial, updateMaterial, verifyCertificate, type materialInput } from "@/lib/services/materials";
import { formToObject } from "@/lib/validation";
import type { z } from "zod";

/** The disposition forms share one page, so each uses its own field name. */
const firstNote = (fd: FormData) => {
  for (const [k, v] of fd.entries()) if (!k.startsWith("$") && typeof v === "string" && v.trim()) return v.trim();
  return null;
};

type MaterialInput = z.input<typeof materialInput>;

export async function createMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const m = await createMaterial(actor, { ...(formToObject(fd) as MaterialInput), identificationMismatch: fd.has("identificationMismatch") });
    return { message: `${m.code} registered.`, redirect: `/materials/${m.id}` };
  }, ["/materials"]);
}

export async function updateMaterialAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await updateMaterial(actor, id, { ...(formToObject(fd) as Partial<MaterialInput>), identificationMismatch: fd.has("identificationMismatch") });
    return "Material updated.";
  }, [`/materials/${id}`, "/materials"]);
}

export async function verifyCertAction(id: string, verified: boolean, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await verifyCertificate(actor, id, verified, firstNote(fd));
    return verified ? "Certificate verified." : "Certificate rejected.";
  }, [`/materials/${id}`, "/materials"]);
}

export async function dispositionAction(id: string, decision: MaterialStatus, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await dispositionMaterial(actor, id, decision, firstNote(fd));
    return `Material status: ${decision.toLowerCase().replace(/_/g, " ")}.`;
  }, [`/materials/${id}`, "/materials"]);
}
