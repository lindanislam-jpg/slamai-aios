"use server";

import type { ActionStatus, FindingStatus } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { addFinding, moveFinding, saveAudit } from "@/lib/services/audits";
import { addAction, updateActionStatus } from "@/lib/services/ncrs";

export async function saveAuditAction(id: string | null, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const a = await saveAudit(actor, id, formToObject(fd) as Parameters<typeof saveAudit>[2]);
    return id ? "Audit saved." : { message: `${a.code} scheduled.`, redirect: `/audits/${a.id}` };
  }, ["/audits", ...(id ? [`/audits/${id}`] : [])]);
}

export async function addFindingAction(auditId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const f = await addFinding(actor, auditId, formToObject(fd) as Parameters<typeof addFinding>[2]);
    return `${f.code} recorded.`;
  }, [`/audits/${auditId}`]);
}

export async function moveFindingAction(auditId: string, findingId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await moveFinding(actor, findingId, String(fd.get("status")) as FindingStatus, (fd.get("evidence") as string) || null);
    return "Finding updated.";
  }, [`/audits/${auditId}`]);
}

export async function addFindingCapaAction(auditId: string, findingId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const a = await addAction(actor, { ...formToObject(fd), auditFindingId: findingId } as Parameters<typeof addAction>[1]);
    return `${a.code} added.`;
  }, [`/audits/${auditId}`]);
}

export async function findingActionStatus(auditId: string, actionId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateActionStatus(actor, actionId, String(fd.get("status")) as ActionStatus, (fd.get("note") as string) || null);
    return "Action updated.";
  }, [`/audits/${auditId}`]);
}
