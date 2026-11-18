import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, unauthorized } from "./api";
import type { RemitAdmin, RemitCustomer } from "@prisma/client";

/**
 * Access control for the remittance module.
 *
 * Two separate populations, never conflated:
 *   - customers, resolved via `RemitCustomer` from the signed-in user
 *   - admins, resolved via an explicit `RemitAdmin` grant with permissions
 *
 * Being a platform user does not make you a remittance customer, and no
 * customer role can ever escalate into admin: admin is a row in a different
 * table that only another admin (or the seed script) can create.
 */

export const PERMISSIONS = {
  VIEW_CUSTOMERS: "customers:view",
  SUSPEND_CUSTOMERS: "customers:suspend",
  VIEW_TRANSFERS: "transfers:view",
  REVIEW_COMPLIANCE: "compliance:review",
  MANAGE_FEES: "fees:manage",
  MANAGE_CORRIDORS: "corridors:manage",
  VIEW_AUDIT: "audit:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Full-access role granted by the seed script to the first admin. */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name ?? null };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function getCustomer(): Promise<RemitCustomer | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return db.remitCustomer.findUnique({ where: { userId: user.id } });
}

/**
 * Require a customer who is allowed to transact. A suspended or closed account
 * is rejected here, before any service code runs.
 */
export async function requireActiveCustomer(): Promise<RemitCustomer> {
  const user = await requireSessionUser();
  const customer = await db.remitCustomer.findUnique({ where: { userId: user.id } });
  if (!customer) throw forbidden("Finish setting up your account to continue");
  if (customer.status === "SUSPENDED") {
    throw forbidden("Your account is on hold. Contact support to continue.");
  }
  if (customer.status === "CLOSED") throw forbidden("This account is closed");
  return customer;
}

/** Any customer record, including one still awaiting verification. */
export async function requireCustomer(): Promise<RemitCustomer> {
  const user = await requireSessionUser();
  const customer = await db.remitCustomer.findUnique({ where: { userId: user.id } });
  if (!customer) throw forbidden("Finish setting up your account to continue");
  return customer;
}

export interface AdminContext {
  user: SessionUser;
  admin: RemitAdmin;
}

export async function getAdmin(): Promise<AdminContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = await db.remitAdmin.findUnique({ where: { userId: user.id } });
  if (!admin) return null;
  return { user, admin };
}

export async function requireAdmin(...required: Permission[]): Promise<AdminContext> {
  const context = await getAdmin();
  if (!context) throw forbidden("Admin access required");
  if (required.length > 0) {
    const missing = required.filter((permission) => !context.admin.permissions.includes(permission));
    if (missing.length > 0) {
      throw forbidden(`Missing permission: ${missing.join(", ")}`);
    }
  }
  return context;
}

export function hasPermission(admin: RemitAdmin, permission: Permission): boolean {
  return admin.permissions.includes(permission);
}
