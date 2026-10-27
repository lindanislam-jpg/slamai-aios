import "server-only";
import { revalidatePath } from "next/cache";
import { requireApiActor } from "./auth";
import { publicMessage } from "./errors";
import type { Actor } from "./permissions";

export type ActionState = { ok: boolean; message?: string; error?: string; redirect?: string; at?: number } | null;

/**
 * Wrap a server action: resolve the signed-in user, run the work, turn any
 * error into a safe message, and revalidate the affected pages.
 */
export async function run(work: (actor: Actor) => Promise<string | { message?: string; redirect?: string } | void>, paths: string[] = []): Promise<ActionState> {
  try {
    const actor = await requireApiActor();
    const res = await work(actor);
    for (const p of paths) revalidatePath(p);
    revalidatePath("/", "layout");
    const r = typeof res === "string" ? { message: res } : res ?? {};
    return { ok: true, message: r.message ?? "Saved.", redirect: r.redirect, at: Date.now() };
  } catch (err) {
    return { ok: false, error: publicMessage(err), at: Date.now() };
  }
}
