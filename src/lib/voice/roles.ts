/**
 * Roles and permissions for a business workspace.
 *
 * Permissions are checked server-side on every mutating route via
 * `requireTenant({ permission })`. The UI also hides what a role cannot do,
 * but that is a convenience only — never the control.
 */

export const ROLES = ["owner", "admin", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including billing and deleting the workspace.",
  admin: "Everything except billing and workspace deletion.",
  manager: "Runs the day to day: leads, calls, appointments, the AI agent.",
  staff: "Can see calls, leads and appointments, and update their outcomes.",
};

export const PERMISSIONS = [
  "business.read",
  "business.write",
  "team.read",
  "team.write",
  "agent.read",
  "agent.write",
  "knowledge.read",
  "knowledge.write",
  "calls.read",
  "leads.read",
  "leads.write",
  "appointments.read",
  "appointments.write",
  "phone.read",
  "phone.write",
  "analytics.read",
  "billing.read",
  "billing.write",
  "integrations.read",
  "integrations.write",
  "audit.read",
  "workspace.delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER: Permission[] = [
  "business.read",
  "team.read",
  "agent.read",
  "agent.write",
  "knowledge.read",
  "knowledge.write",
  "calls.read",
  "leads.read",
  "leads.write",
  "appointments.read",
  "appointments.write",
  "phone.read",
  "analytics.read",
  "integrations.read",
];

const STAFF: Permission[] = [
  "business.read",
  "agent.read",
  "knowledge.read",
  "calls.read",
  "leads.read",
  "leads.write",
  "appointments.read",
  "appointments.write",
];

const ADMIN: Permission[] = [
  ...MANAGER,
  "business.write",
  "team.write",
  "phone.write",
  "integrations.write",
  "audit.read",
  "billing.read",
];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: ADMIN,
  manager: MANAGER,
  staff: STAFF,
};

export function can(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? perms.includes(permission) : false;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** A role may only assign roles at or below its own level. */
const RANK: Record<Role, number> = { owner: 4, admin: 3, manager: 2, staff: 1 };

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  if (actorRole === "owner") return true;
  return RANK[actorRole] > RANK[targetRole];
}
