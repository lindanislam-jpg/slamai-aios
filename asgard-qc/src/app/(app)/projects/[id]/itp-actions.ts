"use server";

import { run, type ActionState } from "@/lib/action";
import { markNotApplicable, reopenControlPoint, signControlPoint } from "@/lib/services/itp";

export async function signPointAction(projectId: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await signControlPoint(actor, id, String(fd.get("evidence") ?? ""));
    return "Signed.";
  }, [`/projects/${projectId}`]);
}

export async function naPointAction(projectId: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await markNotApplicable(actor, id, String(fd.get("reason") ?? ""));
    return "Marked not applicable.";
  }, [`/projects/${projectId}`]);
}

export async function reopenPointAction(projectId: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await reopenControlPoint(actor, id, String(fd.get("reason") ?? ""));
    return "Reopened.";
  }, [`/projects/${projectId}`]);
}
