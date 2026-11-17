"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApiActor } from "@/lib/auth";
import { publicMessage } from "@/lib/errors";
import { markPackReturned, recordPack } from "@/lib/services/quality-packs";

function back(fd: FormData, msg: string) {
  const to = String(fd.get("back") ?? "/quality-packs");
  const url = new URL(to.startsWith("/") ? to : "/quality-packs", "http://x");
  url.searchParams.set("msg", msg);
  for (const p of ["/quality-packs", "/"]) revalidatePath(p);
  redirect(`${url.pathname}${url.search}${url.hash}`);
}

export async function recordPackAction(fd: FormData) {
  const actor = await requireApiActor();
  let msg: string;
  try {
    const r = await recordPack(actor, {
      projectId: String(fd.get("projectId") ?? ""), discipline: String(fd.get("discipline") ?? ""), name: String(fd.get("name") ?? ""),
      stage: String(fd.get("stage") ?? "") as "ISSUED", date: String(fd.get("date") ?? "") || null,
      returnedByName: String(fd.get("returnedByName") ?? "") || null, notes: String(fd.get("notes") ?? "") || null,
    });
    msg = `${r.code} recorded.`;
  } catch (e) {
    msg = publicMessage(e);
  }
  back(fd, msg);
}

export async function markReturnedAction(fd: FormData) {
  const actor = await requireApiActor();
  let msg: string;
  try {
    const r = await markPackReturned(actor, String(fd.get("id") ?? ""), { date: String(fd.get("date") ?? "") || null, returnedByName: String(fd.get("returnedByName") ?? "") || null });
    msg = `${r.code} marked returned.`;
  } catch (e) {
    msg = publicMessage(e);
  }
  back(fd, msg);
}

export async function packsFromFilesAction(input: { projectId: string; discipline: string; stage: "ISSUED" | "RETURNED"; date?: string | null; fileCodes: string[] }) {
  try {
    const actor = await requireApiActor();
    const { packsFromFiles } = await import("@/lib/services/quality-packs");
    const r = await packsFromFiles(actor, input);
    for (const p of ["/quality-packs", "/", `/projects/${input.projectId}`]) revalidatePath(p);
    return { ok: true as const, ...r };
  } catch (e) {
    return { ok: false as const, error: publicMessage(e) };
  }
}
