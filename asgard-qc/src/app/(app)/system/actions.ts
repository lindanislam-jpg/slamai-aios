"use server";

import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { retryRun, runManual, updateMonitorSettings } from "@/lib/monitor/run";

export async function runNowAction() {
  return run(async (actor) => {
    const r = await runManual(actor);
    return { message: `${r.code} ${r.status.toLowerCase()}: ${r.passed} passed, ${r.warnings} warnings, ${r.failed} failed, ${r.notRun} not run.`, redirect: `/system/${r.id}` };
  }, ["/system", "/"]);
}

export async function retryRunAction(id: string) {
  return run(async (actor) => {
    const r = await retryRun(actor, id);
    return { message: `${r.code} ${r.status.toLowerCase()}.`, redirect: `/system/${r.id}` };
  }, ["/system", "/"]);
}

export async function saveMonitorSettingsAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateMonitorSettings(actor, formToObject(fd));
    return "Scheduled-check settings saved.";
  }, ["/system", "/"]);
}
