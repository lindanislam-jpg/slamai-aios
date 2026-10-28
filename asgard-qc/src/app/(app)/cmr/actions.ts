"use server";

import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { moveCmr, raiseCmr, reopenCmr, updateCmrWork } from "@/lib/services/cmrs";
import { runNotificationScan } from "@/lib/services/notifications";

/** Re-evaluate alert rules after a change; a failed scan never blocks the change itself. */
const rescan = () => runNotificationScan().catch((e) => console.error("alert scan failed", e));

export async function raiseCmrAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const c = await raiseCmr(actor, formToObject(fd) as Parameters<typeof raiseCmr>[1]);
    await rescan();
    return { message: `${c.code} raised.`, redirect: `/cmr/${c.id}` };
  }, ["/cmr", "/alerts"]);
}

export async function updateCmrWorkAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateCmrWork(actor, id, formToObject(fd) as Parameters<typeof updateCmrWork>[2]);
    await rescan();
    return "Work log saved.";
  }, [`/cmr/${id}`, "/cmr"]);
}

export async function moveCmrAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const c = await moveCmr(actor, id, formToObject(fd) as Parameters<typeof moveCmr>[2]);
    await rescan();
    return `${c.code} is now ${c.status.replace(/_/g, " ").toLowerCase()}.`;
  }, [`/cmr/${id}`, "/cmr", "/alerts"]);
}

export async function reopenCmrAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const c = await reopenCmr(actor, id, String(fd.get("reason") ?? ""));
    await rescan();
    return `${c.code} reopened. The earlier closure is kept in its history.`;
  }, [`/cmr/${id}`, "/cmr", "/alerts"]);
}
