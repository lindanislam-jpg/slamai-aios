"use server";

import { run, type ActionState } from "@/lib/action";
import { addDefect, confirmDefect, createWeld, recordVisual, recordWeldRepair, updateWeld, type weldInput } from "@/lib/services/welding";
import { formToObject } from "@/lib/validation";
import type { z } from "zod";

type WeldInput = z.input<typeof weldInput>;

export async function createWeldAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const w = await createWeld(actor, { ...(formToObject(fd) as WeldInput), ndtRequired: fd.has("ndtRequired") });
    return { message: `Weld ${w.weldRef} registered.`, redirect: `/welding/${w.id}` };
  }, ["/welding"]);
}

export async function updateWeldAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await updateWeld(actor, id, { ...(formToObject(fd) as Partial<WeldInput>), ndtRequired: fd.has("ndtRequired") });
    return "Weld updated.";
  }, [`/welding/${id}`, "/welding"]);
}

export async function recordVisualAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const status = await recordVisual(actor, id, formToObject(fd) as Parameters<typeof recordVisual>[2]);
    return `Visual result recorded — weld status now ${status.toLowerCase().replace(/_/g, " ")}.`;
  }, [`/welding/${id}`, "/welding"]);
}

export async function addDefectAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const d = await addDefect(actor, id, { category: String(fd.get("category") ?? ""), notes: String(fd.get("defectNotes") ?? "").trim() || null });
    return d.confirmed ? "Defect recorded and confirmed." : "Defect recorded — awaiting confirmation by an authorised welding inspector.";
  }, [`/welding/${id}`, "/welding"]);
}

export async function confirmDefectAction(weldId: string, defectId: string, confirmed: boolean, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await confirmDefect(actor, defectId, confirmed, String(fd.get("note") ?? "").trim() || undefined);
    return confirmed ? "Defect confirmed." : "Defect dismissed (kept in history).";
  }, [`/welding/${weldId}`, "/welding"]);
}

export async function recordRepairAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const r = await recordWeldRepair(actor, id, { ...(formToObject(fd) as Parameters<typeof recordWeldRepair>[2]), costIsEstimate: fd.has("costIsEstimate") });
    return `${r.code} logged — weld awaits re-inspection.`;
  }, [`/welding/${id}`, "/welding", "/rework"]);
}
