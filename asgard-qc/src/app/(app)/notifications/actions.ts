"use server";

import { run, type ActionState } from "@/lib/action";
import { ForbiddenError } from "@/lib/errors";
import { markRead, runNotificationScan, setMuted } from "@/lib/services/notifications";

export async function markReadAction(ids: string[] | "all") {
  return run(async (actor) => {
    await markRead(actor, ids);
    return "Marked as read.";
  }, ["/notifications"]);
}

export async function muteAction(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    await setMuted(actor, fd.getAll("muted").map(String));
    return "Preferences saved.";
  }, ["/notifications"]);
}

export async function scanAction() {
  return run(async (actor) => {
    if (!actor.permissions.has("settings.manage") && !actor.permissions.has("ncr.manage")) throw new ForbiddenError();
    const r = await runNotificationScan();
    return `Scan complete: ${r.conditions} condition(s), ${r.resolved} resolved.`;
  }, ["/notifications"]);
}
