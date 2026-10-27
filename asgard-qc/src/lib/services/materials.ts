import { InspectionResult, MaterialStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { diff, recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { bool, optDate, optId, optNum, optStr, reqStr } from "../validation";
import { assertCan, found, transaction } from "./base";

export const materialInput = z.object({
  projectId: optId,
  componentRef: optStr(200),
  description: reqStr(500),
  grade: optStr(80),
  supplier: optStr(200),
  poRef: optStr(120),
  deliveryRef: optStr(120),
  heatNumber: optStr(120),
  certificateRef: optStr(200),
  quantity: optNum,
  unit: optStr(20),
  location: optStr(200),
  identificationMismatch: bool.optional(),
  receivingResult: z.nativeEnum(InspectionResult).optional(),
  inspectorName: optStr(200),
  inspectedAt: optDate,
});

export async function createMaterial(actor: Actor, raw: z.input<typeof materialInput>) {
  assertCan(actor, "material.write");
  const input = materialInput.parse(raw);
  return transaction(async (tx) => {
    const code = await nextCode(tx, "MT", 5);
    const row = await tx.material.create({
      data: {
        ...input,
        code,
        // Recording a certificate number is not verifying it.
        certStatus: input.certificateRef ? "UPLOADED_UNVERIFIED" : "MISSING",
      },
    });
    await recordEvent(tx, actor, "material.create", "Material", row.id, { summary: `${code} ${input.description}`, after: input });
    return row;
  });
}

export async function updateMaterial(actor: Actor, id: string, raw: Partial<z.input<typeof materialInput>>) {
  assertCan(actor, "material.write");
  const input = materialInput.partial().parse(raw);
  return transaction(async (tx) => {
    const before = found(await tx.material.findUnique({ where: { id } }), "Material");
    const data: Prisma.MaterialUncheckedUpdateInput = { ...input };
    // Changing identification data after acceptance invalidates verification.
    const identityChanged = (["heatNumber", "certificateRef", "grade"] as const).some((k) => k in input && input[k] !== before[k]);
    if (identityChanged) {
      if (before.certStatus === "VERIFIED") data.certStatus = input.certificateRef || before.certificateRef ? "UPLOADED_UNVERIFIED" : "MISSING";
      if (before.status === "ACCEPTED") data.status = "AWAITING_INSPECTION";
    }
    if (before.certStatus === "MISSING" && input.certificateRef) data.certStatus = "UPLOADED_UNVERIFIED";
    const row = await tx.material.update({ where: { id }, data });
    const d = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (d.changed) await recordEvent(tx, actor, "material.update", "Material", id, { summary: before.code + (identityChanged ? " — identification changed, re-verification required" : ""), before: d.before, after: d.after });
    return row;
  });
}

export async function verifyCertificate(actor: Actor, id: string, verified: boolean, notes?: string | null) {
  assertCan(actor, "material.disposition");
  return transaction(async (tx) => {
    const m = found(await tx.material.findUnique({ where: { id } }), "Material");
    if (!m.certificateRef && !m.certificateDocId) throw new ValidationError("Record the certificate reference before verifying it.");
    if (!verified && !notes) throw new ValidationError("Give a reason for rejecting the certificate.");
    const row = await tx.material.update({ where: { id }, data: { certStatus: verified ? "VERIFIED" : "REJECTED" } });
    await recordEvent(tx, actor, verified ? "material.cert.verify" : "material.cert.reject", "Material", id, { summary: `${m.code} certificate ${m.certificateRef ?? ""} ${verified ? "verified" : "rejected"}${notes ? `: ${notes}` : ""}` });
    return row;
  });
}

/** Everything stopping a material from being accepted. Pure, for UI and tests. */
export function acceptanceGaps(m: {
  heatNumber: string | null;
  certStatus: string;
  receivingResult: InspectionResult;
  identificationMismatch: boolean;
  grade: string | null;
}) {
  const gaps: string[] = [];
  if (!m.heatNumber) gaps.push("No heat / batch number recorded.");
  if (!m.grade) gaps.push("No material grade recorded.");
  if (m.certStatus !== "VERIFIED") gaps.push(m.certStatus === "MISSING" ? "Material certificate missing." : m.certStatus === "REJECTED" ? "Material certificate rejected." : "Material certificate not yet verified.");
  if (m.receivingResult !== "PASS") gaps.push("Receiving inspection has not passed.");
  if (m.identificationMismatch) gaps.push("Physical identification does not match documentation.");
  return gaps;
}

export async function dispositionMaterial(actor: Actor, id: string, decision: MaterialStatus, notes?: string | null) {
  assertCan(actor, "material.disposition");
  return transaction(async (tx) => {
    const m = found(await tx.material.findUnique({ where: { id } }), "Material");
    if (decision === "ACCEPTED") {
      const gaps = acceptanceGaps(m);
      if (gaps.length) throw new ValidationError(`Cannot accept ${m.code}: ${gaps.join(" ")}`);
    } else if (decision !== "AWAITING_INSPECTION" && !notes) {
      throw new ValidationError("Give a reason for rejection or quarantine.");
    }
    const row = await tx.material.update({
      where: { id },
      data: { status: decision, dispositionById: actor.id, dispositionAt: new Date(), dispositionNotes: notes ?? null },
    });
    await recordEvent(tx, actor, "material.disposition", "Material", id, { summary: `${m.code} → ${decision}${notes ? `: ${notes}` : ""}`, before: { status: m.status }, after: { status: decision } });
    return row;
  });
}

export function materialFlags(m: { heatNumber: string | null; certStatus: string; status: string; identificationMismatch: boolean; receivingResult: string }) {
  const flags: string[] = [];
  if (!m.heatNumber) flags.push("Missing heat no.");
  if (m.certStatus === "MISSING") flags.push("No certificate");
  if (m.certStatus === "UPLOADED_UNVERIFIED") flags.push("Cert unverified");
  if (m.certStatus === "REJECTED") flags.push("Cert rejected");
  if (m.identificationMismatch) flags.push("ID mismatch");
  if (m.status === "QUARANTINED") flags.push("Quarantined");
  if (m.status === "AWAITING_INSPECTION") flags.push("Awaiting inspection");
  return flags;
}

export interface MaterialFilter {
  projectId?: string | null;
  status?: MaterialStatus | null;
  certStatus?: string | null;
  q?: string | null;
  gapsOnly?: boolean;
}

export async function listMaterials(actor: Actor, f: MaterialFilter) {
  assertCan(actor, "records.view");
  const where: Prisma.MaterialWhereInput = {
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.certStatus ? { certStatus: f.certStatus as Prisma.EnumCertStatusFilter["equals"] } : {}),
    ...(f.gapsOnly ? { OR: [{ heatNumber: null }, { certStatus: { not: "VERIFIED" } }, { identificationMismatch: true }, { status: { in: ["QUARANTINED", "AWAITING_INSPECTION"] } }] } : {}),
    ...(f.q
      ? {
          AND: [
            {
              OR: [
                { code: { contains: f.q, mode: "insensitive" } },
                { heatNumber: { contains: f.q, mode: "insensitive" } },
                { grade: { contains: f.q, mode: "insensitive" } },
                { certificateRef: { contains: f.q, mode: "insensitive" } },
                { componentRef: { contains: f.q, mode: "insensitive" } },
                { description: { contains: f.q, mode: "insensitive" } },
                { supplier: { contains: f.q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };
  return db.material.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { project: { select: { code: true } }, _count: { select: { photos: true, ncrs: true } } } });
}

export async function getMaterial(actor: Actor, id: string) {
  assertCan(actor, "records.view");
  const material = found(
    await db.material.findUnique({
      where: { id },
      include: { project: { select: { id: true, code: true, name: true } }, photos: { where: { deletedAt: null } }, ncrs: { select: { id: true, code: true, status: true } } },
    }),
    "Material",
  );
  const history = await db.auditEvent.findMany({ where: { entityType: "Material", entityId: id }, orderBy: { at: "desc" } });
  return { material, history };
}
