"use server";

import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { moveAlert, updateRule } from "@/lib/services/alerts";
import { runNotificationScan } from "@/lib/services/notifications";

export async function moveAlertAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const a = await moveAlert(actor, id, formToObject(fd) as Parameters<typeof moveAlert>[2]);
    return `${a.code} is now ${a.status.replace(/_/g, " ").toLowerCase()}.`;
  }, [`/alerts/${id}`, "/alerts"]);
}

export async function rescanAction() {
  return run(async () => {
    const r = await runNotificationScan();
    return `Rules evaluated: ${r.alerts.raised} raised, ${r.alerts.reopened} reopened, ${r.alerts.cleared} cleared.`;
  }, ["/alerts"]);
}

export async function updateRuleAction(key: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const raw = formToObject(fd);
    const params = Object.fromEntries(Object.entries(raw).filter(([k]) => k.startsWith("p.")).map(([k, v]) => [k.slice(2), v]));
    const r = await updateRule(actor, key, { enabled: raw.enabled ?? false, severity: raw.severity, params });
    await runNotificationScan().catch((e) => console.error("alert scan failed", e));
    return `${r.name} saved (version ${r.version}).`;
  }, ["/settings", "/alerts"]);
}
