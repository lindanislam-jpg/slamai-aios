import type { Role } from "@prisma/client";

/**
 * Every action the app checks. Roles map to a default set below; an
 * administrator can override the map in Settings → Permissions.
 */
export const PERMISSIONS = {
  "records.view": "View quality records",
  "project.write": "Create and edit projects, modules and frames",
  "photo.upload": "Upload photographic evidence",
  "photo.edit": "Edit photo metadata",
  "photo.review": "Review / approve photographic evidence",
  "photo.download": "Download original photographs",
  "inspection.write": "Create and record inspections",
  "inspection.review": "Review and accept/reject inspections",
  "fabrication.write": "Record fabrication QC",
  "weld.write": "Record welds and weld inspections",
  "weld.confirm": "Confirm weld defects and accept repairs",
  "material.write": "Register materials and receiving inspections",
  "material.disposition": "Accept, reject or quarantine material; verify certificates",
  "ndt.write": "Record NDT and test results",
  "coating.write": "Record painting and coating inspections",
  "ncr.raise": "Raise NCRs",
  "ncr.manage": "Investigate NCRs and manage corrective actions",
  "ncr.close": "Verify and close NCRs",
  "rework.write": "Record rework and repairs",
  "release.approve": "Authorise final release",
  "release.concession": "Release with a documented concession",
  "audit.write": "Plan audits and record findings",
  "file.upload": "Attach files to projects",
  "file.remove": "Withdraw files attached to projects",
  "document.write": "Register documents and upload revisions",
  "document.approve": "Approve document revisions",
  "calibration.write": "Manage equipment register and calibration",
  "cmr.raise": "Raise corrective maintenance requests (CMR)",
  "cmr.work": "Acknowledge, assign and record maintenance work on CMRs",
  "cmr.verify": "Verify repairs and approve equipment return to service",
  "alert.manage": "Acknowledge, assign, resolve and dismiss quality alerts",
  "report.generate": "Generate PDF quality reports",
  "export.excel": "Export to Excel",
  "users.manage": "Manage users and roles",
  "settings.manage": "Change configuration and integrations",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as Permission[];

const INSPECTOR_BASE: Permission[] = [
  "records.view", "photo.upload", "photo.edit", "photo.download", "file.upload",
  "inspection.write", "ncr.raise", "rework.write", "report.generate", "export.excel", "cmr.raise",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  QUALITY_MANAGER: ALL.filter((p) => p !== "users.manage" && p !== "settings.manage"),
  QC_INSPECTOR: [...INSPECTOR_BASE, "fabrication.write", "coating.write", "ndt.write", "project.write"],
  WELDING_INSPECTOR: [...INSPECTOR_BASE, "weld.write", "weld.confirm", "ndt.write", "fabrication.write"],
  MATERIAL_INSPECTOR: [...INSPECTOR_BASE, "material.write", "material.disposition"],
  PRODUCTION_VIEWER: ["records.view"],
  AUDITOR: ["records.view", "photo.download", "report.generate", "export.excel"],
  PRODUCTION_SUPERVISOR: ["records.view", "photo.upload", "photo.download", "file.upload", "ncr.raise", "rework.write", "cmr.raise", "alert.manage", "report.generate", "export.excel"],
  MAINTENANCE_TECHNICIAN: ["records.view", "photo.upload", "cmr.raise", "cmr.work", "export.excel"],
  PROJECT_MANAGER: ["records.view", "project.write", "photo.upload", "photo.download", "file.upload", "ncr.raise", "cmr.raise", "alert.manage", "report.generate", "export.excel"],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  QUALITY_MANAGER: "Quality Manager",
  QC_INSPECTOR: "QC Inspector",
  WELDING_INSPECTOR: "Welding Inspector",
  MATERIAL_INSPECTOR: "Material Inspector",
  PRODUCTION_VIEWER: "Production Viewer",
  AUDITOR: "Auditor / Read-only",
  PRODUCTION_SUPERVISOR: "Production Supervisor",
  MAINTENANCE_TECHNICIAN: "Maintenance Technician",
  PROJECT_MANAGER: "Project Manager",
};

export type RolePermissionMap = Partial<Record<Role, Permission[]>>;

/** Resolve a role's permissions, applying any stored override. Admins always
 *  keep users.manage and settings.manage so nobody can lock themselves out. */
export function permissionsFor(role: Role, overrides?: RolePermissionMap | null): Set<Permission> {
  const list = overrides?.[role] ?? DEFAULT_ROLE_PERMISSIONS[role];
  const set = new Set(list.filter((p): p is Permission => p in PERMISSIONS));
  if (role === "ADMIN") {
    set.add("users.manage");
    set.add("settings.manage");
    set.add("records.view");
  }
  return set;
}

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Set<Permission>;
}

export function can(actor: Actor | null | undefined, perm: Permission): boolean {
  return !!actor && actor.permissions.has(perm);
}
