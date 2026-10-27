import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { recordEvent } from "../audit";
import { ValidationError } from "../errors";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { getSetting, type ReleaseRules } from "../settings";
import { assertCan, found, transaction } from "./base";
import { OPEN_NCR } from "./ncrs";

export type CheckState = "PASS" | "FAIL" | "NOT_REQUIRED";

export interface ReleaseCheck {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
  items?: string[];
}

/** Snapshot of everything the release gate looks at. */
export interface ReleaseContext {
  inspections: { code: string; type: string; status: string; result: string; id: string; reinspectionOfId: string | null }[];
  ncrs: { code: string; status: string; actions: { code: string; status: string }[] }[];
  materials: { code: string; status: string; certStatus: string }[];
  welds: { weldRef: string; status: string }[];
  ndt: { code: string; result: string }[];
  photoCategories: string[];
}

/**
 * Evaluate release rules. Pure function — the same input always gives the
 * same answer, which is what gets stored with the release record.
 */
export function evaluateRelease(ctx: ReleaseContext, rules: ReleaseRules): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const add = (key: string, label: string, enabled: boolean, failing: string[], okDetail: string, failDetail: string) =>
    checks.push({
      key,
      label,
      state: !enabled ? "NOT_REQUIRED" : failing.length ? "FAIL" : "PASS",
      detail: !enabled ? "Not required by current release rules." : failing.length ? failDetail : okDetail,
      items: failing.length ? failing : undefined,
    });

  const live = ctx.inspections.filter((i) => i.status !== "CANCELLED");
  const finals = live.filter((i) => i.type === "FINAL");
  const finalOk = finals.some((i) => i.result === "PASS" && i.status === "ACCEPTED");
  add("final", "Final inspection passed and accepted", rules.requireFinalInspectionPass, finalOk ? [] : [finals.length ? "Final inspection not yet passed and accepted" : "No final inspection recorded"], "Final inspection passed and accepted by a reviewer.", "Final inspection outstanding.");

  // A failed/held inspection is resolved by an accepted passing re-inspection.
  const resolvedBy = new Set(live.filter((i) => i.reinspectionOfId && i.result === "PASS" && i.status === "ACCEPTED").map((i) => i.reinspectionOfId));
  const unresolved = live.filter(
    (i) =>
      i.status === "DRAFT" ||
      i.status === "SUBMITTED" ||
      i.status === "REVIEWED" ||
      i.status === "REJECTED" ||
      ((i.result === "FAIL" || i.result === "HOLD" || i.result === "PENDING") && !resolvedBy.has(i.id)),
  );
  add("inspections", "All inspections complete, reviewed and resolved", rules.requireNoUnresolvedInspections, unresolved.map((i) => `${i.code} — ${i.status.toLowerCase()}, result ${i.result.toLowerCase()}`), `${live.length} inspection(s) complete.`, `${unresolved.length} inspection(s) unresolved.`);

  const openNcrs = ctx.ncrs.filter((n) => OPEN_NCR.includes(n.status as (typeof OPEN_NCR)[number]));
  add("ncrs", "No open NCRs", rules.requireNoOpenNcrs, openNcrs.map((n) => `${n.code} — ${n.status.toLowerCase().replace(/_/g, " ")}`), "No open non-conformances.", `${openNcrs.length} NCR(s) open.`);

  const openActions = ctx.ncrs.flatMap((n) => n.actions.filter((a) => a.status !== "VERIFIED" && a.status !== "CANCELLED").map((a) => `${a.code} (${n.code}) — ${a.status.toLowerCase()}`));
  add("actions", "All corrective actions verified", rules.requireNoOpenActions, openActions, "All corrective actions verified.", `${openActions.length} action(s) not verified.`);

  const usable = ctx.materials.filter((m) => m.status !== "REJECTED");
  const notAccepted = usable.filter((m) => m.status !== "ACCEPTED");
  add("materials", "Materials accepted (none quarantined or awaiting inspection)", rules.requireMaterialsAccepted, notAccepted.map((m) => `${m.code} — ${m.status.toLowerCase().replace(/_/g, " ")}`), usable.length ? `${usable.length} material record(s) accepted.` : "No material records linked to this project.", `${notAccepted.length} material(s) not accepted.`);

  const certGaps = usable.filter((m) => m.certStatus !== "VERIFIED");
  add("certs", "Material certificates verified", rules.requireCertificatesVerified, certGaps.map((m) => `${m.code} — certificate ${m.certStatus.toLowerCase().replace(/_/g, " ")}`), "All certificates verified.", `${certGaps.length} certificate(s) not verified.`);

  const badWelds = ctx.welds.filter((w) => w.status !== "ACCEPTED");
  add("welds", "All welds accepted", rules.requireWeldsAccepted, badWelds.map((w) => `${w.weldRef} — ${w.status.toLowerCase().replace(/_/g, " ")}`), `${ctx.welds.length} weld(s) accepted.`, `${badWelds.length} weld(s) not accepted.`);

  const pendingNdt = ctx.ndt.filter((n) => n.result === "PENDING");
  add("ndt", "NDT / test reports received", rules.requireNdtComplete, pendingNdt.map((n) => `${n.code} — awaiting report`), "No outstanding NDT reports.", `${pendingNdt.length} NDT report(s) outstanding.`);

  const have = new Set(ctx.photoCategories);
  const missing = rules.requiredPhotoCategories.filter((c) => !have.has(c));
  add("evidence", "Required photographic evidence present", rules.requiredPhotoCategories.length > 0, missing.map((c) => `No photo in “${c}”`), "Required evidence categories present.", `${missing.length} evidence category(ies) missing.`);

  return checks;
}

export async function loadReleaseContext(projectId: string, unitId?: string | null): Promise<ReleaseContext> {
  const scope = unitId ? { projectId, unitId } : { projectId };
  const [inspections, ncrs, materials, welds, ndt, photos] = await Promise.all([
    db.inspection.findMany({ where: scope, select: { id: true, code: true, type: true, status: true, result: true, reinspectionOfId: true } }),
    db.ncr.findMany({ where: { ...scope, status: { not: "CANCELLED" } }, select: { code: true, status: true, actions: { select: { code: true, status: true } } } }),
    // Materials are tracked per project, so a frame release checks the project's materials.
    db.material.findMany({ where: { projectId }, select: { code: true, status: true, certStatus: true } }),
    db.weld.findMany({ where: scope, select: { weldRef: true, status: true } }),
    db.ndtRecord.findMany({ where: scope, select: { code: true, result: true } }),
    db.photo.findMany({ where: { ...scope, deletedAt: null, reviewStatus: { not: "REJECTED" } }, select: { category: true }, distinct: ["category"] }),
  ]);
  return { inspections, ncrs, materials, welds, ndt, photoCategories: photos.map((p) => p.category) };
}

export async function releaseReadiness(actor: Actor, projectId: string, unitId?: string | null) {
  assertCan(actor, "records.view");
  const [rules, ctx] = await Promise.all([getSetting("releaseRules"), loadReleaseContext(projectId, unitId)]);
  const checks = evaluateRelease(ctx, rules);
  const current = await db.releaseRecord.findFirst({
    where: { projectId, unitId: unitId ?? null, revokedAt: null },
    orderBy: { releasedAt: "desc" },
  });
  return { checks, ready: checks.every((c) => c.state !== "FAIL"), rules, current };
}

export interface ReleaseRequest {
  projectId: string;
  unitId?: string | null;
  notes?: string | null;
  concessionRef?: string | null;
  concessionReason?: string | null;
}

/**
 * Authorise a release. Refused while any enabled check fails, unless the
 * person holds release.concession, concessions are enabled, and a documented
 * concession reference and justification are supplied.
 */
export async function authoriseRelease(actor: Actor, req: ReleaseRequest) {
  assertCan(actor, "release.approve");
  const rules = await getSetting("releaseRules");
  return transaction(async (tx) => {
    const project = found(await tx.project.findUnique({ where: { id: req.projectId } }), "Project");
    if (req.unitId) {
      const u = found(await tx.unit.findUnique({ where: { id: req.unitId } }), "Module / frame");
      if (u.projectId !== project.id) throw new ValidationError("That module/frame belongs to a different project.");
    }
    const existing = await tx.releaseRecord.findFirst({ where: { projectId: project.id, unitId: req.unitId ?? null, revokedAt: null } });
    if (existing) throw new ValidationError(`Already released (${existing.code}). Revoke that release first.`);

    const checks = evaluateRelease(await loadReleaseContext(project.id, req.unitId), rules);
    const failing = checks.filter((c) => c.state === "FAIL");
    let status: "RELEASED" | "RELEASED_WITH_CONCESSION" = "RELEASED";
    if (failing.length) {
      if (!rules.allowConcession) throw new ValidationError(`Release blocked: ${failing.map((f) => f.label).join("; ")}.`);
      if (!actor.permissions.has("release.concession")) throw new ValidationError(`Release blocked: ${failing.map((f) => f.label).join("; ")}. A concession needs an authorised Quality Manager.`);
      if (!req.concessionRef?.trim() || !req.concessionReason?.trim()) {
        throw new ValidationError(`Release blocked: ${failing.length} check(s) failing. To release under concession, give the approved concession reference and justification.`);
      }
      status = "RELEASED_WITH_CONCESSION";
    }
    const code = await nextCode(tx, "REL", 4);
    const record = await tx.releaseRecord.create({
      data: {
        code,
        projectId: project.id,
        unitId: req.unitId ?? null,
        status,
        checks: checks as unknown as Prisma.InputJsonValue,
        concessionRef: failing.length ? req.concessionRef : null,
        concessionReason: failing.length ? req.concessionReason : null,
        releasedById: actor.id,
        releasedByName: actor.name,
        notes: req.notes ?? null,
      },
    });
    if (req.unitId) await tx.unit.update({ where: { id: req.unitId }, data: { released: true } });
    else await tx.project.update({ where: { id: project.id }, data: { status: "RELEASED" } });
    await recordEvent(tx, actor, "release.authorise", "ReleaseRecord", record.id, {
      summary: `${code}: ${project.code}${req.unitId ? " frame/module" : ""} ${status.toLowerCase().replace(/_/g, " ")}${failing.length ? ` — concession ${req.concessionRef}` : ""}`,
      after: { status, failing: failing.map((f) => f.key) },
    });
    return record;
  });
}

export async function revokeRelease(actor: Actor, id: string, reason: string) {
  assertCan(actor, "release.approve");
  if (!reason?.trim()) throw new ValidationError("A reason is required to revoke a release.");
  return transaction(async (tx) => {
    const r = found(await tx.releaseRecord.findUnique({ where: { id } }), "Release");
    if (r.revokedAt) throw new ValidationError("Already revoked.");
    await tx.releaseRecord.update({ where: { id }, data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: reason, status: "REVOKED" } });
    if (r.unitId) await tx.unit.update({ where: { id: r.unitId }, data: { released: false } });
    else await tx.project.update({ where: { id: r.projectId }, data: { status: "AWAITING_RELEASE" } });
    await recordEvent(tx, actor, "release.revoke", "ReleaseRecord", id, { summary: `${r.code} revoked: ${reason}` });
  });
}
