"use server";

import type { ActionStatus, InspectionResult, NcrStatus } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { addAction, closeNcr, moveNcr, raiseNcr, recordEffectiveness, updateActionStatus, updateNcr } from "@/lib/services/ncrs";

export async function raiseNcrAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const n = await raiseNcr(actor, formToObject(fd) as Parameters<typeof raiseNcr>[1]);
    return { message: `${n.code} raised.`, redirect: `/ncr/${n.id}` };
  }, ["/ncr"]);
}

export async function updateNcrAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateNcr(actor, id, formToObject(fd));
    return "Investigation saved.";
  }, [`/ncr/${id}`]);
}

export async function moveNcrAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const to = String(fd.get("to")) as NcrStatus;
    await moveNcr(actor, id, to, (fd.get("note") as string) || null);
    return `Moved to ${to.replace(/_/g, " ").toLowerCase()}.`;
  }, [`/ncr/${id}`, "/ncr"]);
}

export async function addActionAction(ncrId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const a = await addAction(actor, { ...formToObject(fd), ncrId } as Parameters<typeof addAction>[1]);
    return `${a.code} added.`;
  }, [`/ncr/${ncrId}`]);
}

export async function actionStatusAction(ncrId: string, actionId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const status = String(fd.get("status")) as ActionStatus;
    await updateActionStatus(actor, actionId, status, (fd.get("note") as string) || null);
    return `Action ${status.toLowerCase().replace(/_/g, " ")}.`;
  }, [`/ncr/${ncrId}`]);
}

export async function closeNcrAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await closeNcr(actor, id, {
      verificationNotes: String(fd.get("verificationNotes") ?? ""),
      reinspectionResult: String(fd.get("reinspectionResult") ?? "") as InspectionResult,
    });
    return "NCR closed.";
  }, [`/ncr/${id}`, "/ncr"]);
}

export async function impactAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateNcr(actor, id, formToObject(fd));
    return "Impact assessment saved.";
  }, [`/ncr/${id}`]);
}

export async function effectivenessAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const status = String(fd.get("effectiveness")) === "NOT_EFFECTIVE" ? "NOT_EFFECTIVE" : "EFFECTIVE";
    await recordEffectiveness(actor, id, status, String(fd.get("notes") ?? ""));
    return status === "EFFECTIVE" ? "Recorded as effective." : "Recorded as not effective — NCR reopened.";
  }, [`/ncr/${id}`, "/ncr"]);
}
