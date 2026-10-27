"use server";

import { run, type ActionState } from "@/lib/action";
import { removeProjectFile } from "@/lib/services/files";

export async function removeFileAction(projectId: string, fileId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await removeProjectFile(actor, fileId, String(fd.get("reason") ?? ""));
    return "File removed. The record and stored file are kept in the audit trail.";
  }, [`/projects/${projectId}`]);
}
