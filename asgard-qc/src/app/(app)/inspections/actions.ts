"use server";

import { run, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import {
  cancelInspection,
  createInspection,
  reviewInspection,
  saveChecklist,
  submitInspection,
  updateInspection,
  type InspectionInput,
} from "@/lib/services/inspections";
import { formToObject } from "@/lib/validation";

function parseItems(raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new ValidationError("Checklist could not be read. Reload the page and try again.");
  }
}

export async function createInspectionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const o = formToObject(fd);
    const items = parseItems(o.items);
    delete o.items;
    const insp = await createInspection(actor, { ...(o as unknown as InspectionInput), items });
    return { message: `${insp.code} created.`, redirect: `/inspections/${insp.id}` };
  }, ["/inspections", "/fabrication"]);
}

export async function updateInspectionAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await updateInspection(actor, id, formToObject(fd) as Partial<InspectionInput>);
    return "Inspection updated.";
  }, [`/inspections/${id}`, "/inspections"]);
}

export async function saveChecklistAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await saveChecklist(actor, id, parseItems(fd.get("items")));
    return "Checklist saved.";
  }, [`/inspections/${id}`]);
}

export async function submitInspectionAction(id: string): Promise<ActionState> {
  return run(async (actor) => {
    const r = await submitInspection(actor, id);
    return `${r.code} submitted for review.`;
  }, [`/inspections/${id}`, "/inspections"]);
}

export async function reviewInspectionAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const decision = fd.get("decision") === "REJECTED" ? "REJECTED" : "ACCEPTED";
    const note = String(fd.get("note") ?? "").trim() || null;
    await reviewInspection(actor, id, decision, note);
    return `Inspection ${decision.toLowerCase()}.`;
  }, [`/inspections/${id}`, "/inspections"]);
}

export async function cancelInspectionAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await cancelInspection(actor, id, String(fd.get("reason") ?? ""));
    return "Inspection cancelled.";
  }, [`/inspections/${id}`, "/inspections"]);
}
