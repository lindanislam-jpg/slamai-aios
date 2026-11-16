"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiActor } from "@/lib/auth";
import { publicMessage } from "@/lib/errors";
import { createInspection, submitInspection } from "@/lib/services/inspections";

const input = z.object({
  projectId: z.string().min(1, "Choose a job number."),
  delivered: z.string().trim().min(1, "Say what was delivered.").max(200),
  supplier: z.string().trim().max(120).optional(),
  deliveryNote: z.string().trim().max(80).optional(),
  result: z.enum(["PENDING", "PASS", "FAIL", "HOLD"]),
  notes: z.string().trim().max(2000).optional(),
});

export type IncomingState = { ok: true; id: string; code: string; submitted: boolean; ncr: string | null } | { ok: false; error: string };

/** Creates the incoming (goods-in) inspection for a job. With a result chosen
 *  it is submitted for review straight away; the photos are attached next. */
export async function createIncomingAction(raw: unknown): Promise<IncomingState> {
  try {
    const actor = await requireApiActor();
    const d = input.parse(raw);
    const comments = [d.supplier ? `Supplier: ${d.supplier}` : null, d.deliveryNote ? `Delivery note / PO: ${d.deliveryNote}` : null, d.notes || null].filter(Boolean).join("\n");
    const insp = await createInspection(actor, {
      projectId: d.projectId,
      type: "INCOMING_MATERIAL",
      stage: null,
      componentRef: d.delivered,
      result: d.result,
      inspectedAt: new Date(),
      comments: comments || null,
    });
    let ncr: string | null = null;
    const submit = d.result !== "PENDING";
    if (submit) ncr = (await submitInspection(actor, insp.id)).autoNcr?.code ?? null;
    for (const p of ["/incoming", "/inspections", "/"]) revalidatePath(p);
    return { ok: true, id: insp.id, code: insp.code, submitted: submit, ncr };
  } catch (err) {
    return { ok: false, error: err instanceof z.ZodError ? err.issues[0].message : publicMessage(err) };
  }
}
