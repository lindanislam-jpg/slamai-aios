"use server";

import { run, type ActionState } from "@/lib/action";
import { authoriseRelease, revokeRelease } from "@/lib/services/release";

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function authoriseAction(projectId: string, unitId: string | null, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const r = await authoriseRelease(actor, { projectId, unitId, notes: s(fd, "notes"), concessionRef: s(fd, "concessionRef"), concessionReason: s(fd, "concessionReason") });
    return `${r.code}: ${r.status === "RELEASED" ? "released" : "released under concession"}.`;
  }, ["/release"]);
}

export async function revokeAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await revokeRelease(actor, id, String(fd.get("reason") ?? ""));
    return "Release revoked.";
  }, ["/release"]);
}
