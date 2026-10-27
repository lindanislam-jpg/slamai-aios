"use server";

import type { ReviewStatus } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { applyAiSuggestion, reviewPhoto, updatePhotoMeta, withdrawPhoto } from "@/lib/services/photos";
import { formToObject } from "@/lib/validation";

export async function updatePhotoAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const p = await updatePhotoMeta(actor, id, formToObject(fd));
    return `${p.code} updated.`;
  }, [`/photos/${id}`, "/photos"]);
}

const REVIEW: ReviewStatus[] = ["PENDING_REVIEW", "REVIEWED", "APPROVED", "REJECTED"];

export async function reviewPhotoAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const status = String(fd.get("status")) as ReviewStatus;
    if (!REVIEW.includes(status)) throw new ValidationError("Unknown review status.");
    const note = String(fd.get("note") ?? "").trim() || undefined;
    if (status === "REJECTED" && !note) throw new ValidationError("Give a reason when rejecting evidence.");
    await reviewPhoto(actor, id, status, note);
    return `Marked ${status.replace(/_/g, " ").toLowerCase()}.`;
  }, [`/photos/${id}`, "/photos"]);
}

export async function withdrawPhotoAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await withdrawPhoto(actor, id, String(fd.get("reason") ?? ""));
    return { message: "Photo withdrawn. The original file and record are kept.", redirect: "/photos" };
  }, ["/photos"]);
}

const AI_FIELDS = ["caption", "description", "category", "observedCondition"] as const;

export async function applyAiAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const fields = AI_FIELDS.filter((f) => fd.get(f) === "on");
    if (!fields.length) throw new ValidationError("Tick at least one field to apply.");
    await applyAiSuggestion(actor, id, fields);
    return `Applied ${fields.join(", ")} from the AI draft.`;
  }, [`/photos/${id}`]);
}
