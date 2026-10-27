"use server";

import type { Role } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";
import { approveTemplate, saveTemplate } from "@/lib/services/inspections";
import { purgeDemoData, updateSetting } from "@/lib/services/settings";
import { SETTING_DEFAULTS } from "@/lib/settings";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const int = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  if (!Number.isInteger(n)) throw new ValidationError(`${k} must be a whole number.`);
  return n;
};

export async function saveReleaseRules(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    const b = (k: string) => fd.get(k) === "on";
    await updateSetting(actor, "releaseRules", {
      requireFinalInspectionPass: b("requireFinalInspectionPass"),
      requireNoUnresolvedInspections: b("requireNoUnresolvedInspections"),
      requireNoOpenNcrs: b("requireNoOpenNcrs"),
      requireNoOpenActions: b("requireNoOpenActions"),
      requireMaterialsAccepted: b("requireMaterialsAccepted"),
      requireCertificatesVerified: b("requireCertificatesVerified"),
      requireWeldsAccepted: b("requireWeldsAccepted"),
      requireNdtComplete: b("requireNdtComplete"),
      requiredPhotoCategories: fd.getAll("requiredPhotoCategories").map(String),
      allowConcession: b("allowConcession"),
    });
    return "Release rules saved.";
  }, ["/settings", "/release"]);
}

export async function saveVocabulary(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateSetting(actor, "vocabulary", { photoCategories: [...new Set(lines(fd.get("photoCategories")))], productionStages: [...new Set(lines(fd.get("productionStages")))] });
    return "Vocabulary saved. Existing records keep their values.";
  }, ["/settings"]);
}

export async function saveLimits(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateSetting(actor, "uploadLimits", { maxFileMb: int(fd, "maxFileMb"), maxFilesPerBatch: int(fd, "maxFilesPerBatch") });
    await updateSetting(actor, "notificationThresholds", {
      ncrDueSoonDays: int(fd, "ncrDueSoonDays"),
      actionDueSoonDays: int(fd, "actionDueSoonDays"),
      calibrationDueSoonDays: int(fd, "calibrationDueSoonDays"),
      ndtOutstandingDays: int(fd, "ndtOutstandingDays"),
      quarantineReviewDays: int(fd, "quarantineReviewDays"),
    });
    return "Limits and thresholds saved.";
  }, ["/settings"]);
}

export async function saveBranding(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateSetting(actor, "branding", { companyName: String(fd.get("companyName") ?? ""), departmentName: String(fd.get("departmentName") ?? ""), reportFooter: String(fd.get("reportFooter") ?? "") });
    return "Report branding saved.";
  }, ["/settings"]);
}

export async function savePermissions(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    const map: Record<string, string[]> = {};
    for (const role of Object.keys(ROLE_LABELS)) map[role] = fd.getAll(`perm:${role}`).map(String).filter((p) => p in PERMISSIONS);
    await updateSetting(actor, "rolePermissions", map as Record<Role, string[]>);
    return "Permissions saved. They apply on each user's next page load.";
  }, ["/settings", "/users"]);
}

export async function resetPermissions() {
  return run(async (actor) => {
    await updateSetting(actor, "rolePermissions", SETTING_DEFAULTS.rolePermissions);
    return "Permissions reset to defaults.";
  }, ["/settings", "/users"]);
}

/** Template items: one per line, `description | requirement | tolerance | unit`. */
export async function saveTemplateAction(id: string | null, _: ActionState, fd: FormData) {
  return run(async (actor) => {
    const items = lines(fd.get("items")).map((line) => {
      const [description, requirement, tolerance, unit] = line.split("|").map((s) => s.trim());
      return { description, requirement: requirement || null, tolerance: tolerance || null, unit: unit || null, required: true };
    });
    await saveTemplate(actor, id, {
      name: String(fd.get("name") ?? ""),
      inspectionType: String(fd.get("inspectionType") ?? "") as never,
      documentRef: String(fd.get("documentRef") ?? ""),
      items,
    });
    return { message: id ? "Template updated — it needs re-approval." : "Template created — it needs approval before it is relied on.", redirect: "/settings?tab=templates" };
  }, ["/settings"]);
}

export async function approveTemplateAction(id: string) {
  return run(async (actor) => {
    await approveTemplate(actor, id);
    return "Template approved.";
  }, ["/settings"]);
}

export async function purgeDemoAction(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    if (String(fd.get("confirm") ?? "") !== "DELETE DEMO DATA") throw new ValidationError('Type "DELETE DEMO DATA" to confirm.');
    const r = await purgeDemoData(actor);
    return `Demo data removed: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(", ")}.`;
  }, ["/settings"]);
}
