import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "./roles";

/**
 * Tenant resolution and authorization — the single gate every SlamAI Voice
 * request passes through.
 *
 * Rules this module enforces, so no route has to remember them:
 *   1. The caller is signed in.
 *   2. The caller is a member of the business they are acting on. A businessId
 *      supplied by the client is never trusted until this check passes.
 *   3. The caller's role carries the required permission.
 *   4. The business is not suspended (reads are still allowed so a suspended
 *      tenant can see its data and pay its bill; writes are refused).
 *
 * Every tenant-scoped query must then filter on `ctx.businessId`. Passing the
 * id from this context — never from the request body — is what keeps one
 * business out of another's data.
 */

export type TenantContext = {
  userId: string;
  userEmail: string;
  userName: string | null;
  businessId: string;
  businessName: string;
  businessSlug: string;
  timezone: string;
  currency: string;
  role: string;
  planId: string;
  subscriptionStatus: string;
  isSuspended: boolean;
  isPlatformAdmin: boolean;
};

export type TenantGate =
  | { ok: true; ctx: TenantContext }
  | { ok: false; response: NextResponse };

function deny(message: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/** Reads a caller's active membership, preferring their default workspace. */
async function resolveMembership(userId: string, businessId?: string | null) {
  if (businessId) {
    return db.membership.findUnique({
      where: { userId_businessId: { userId, businessId } },
      include: { business: { include: { subscription: true } } },
    });
  }
  return db.membership.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { business: { include: { subscription: true } } },
  });
}

export type RequireTenantOptions = {
  /** Permission the caller's role must carry. Omit for read-only endpoints. */
  permission?: Permission;
  /** Act on a specific workspace instead of the caller's default. */
  businessId?: string | null;
  /** Set for mutating routes so suspended tenants are refused. */
  write?: boolean;
};

export async function requireTenant(options: RequireTenantOptions = {}): Promise<TenantGate> {
  const session = await auth();
  if (!session?.user?.id) return deny("You need to sign in.", 401);

  const membership = await resolveMembership(session.user.id, options.businessId);
  if (!membership) {
    return deny("No workspace found for this account.", 403);
  }

  const { business } = membership;

  if (options.permission && !can(membership.role, options.permission)) {
    return deny("Your role does not allow this.", 403);
  }

  const suspended = business.status !== "active";
  if (suspended && (options.write || options.permission)) {
    return deny("This workspace is suspended. Contact support to reactivate it.", 403);
  }

  return {
    ok: true,
    ctx: {
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      userName: session.user.name ?? null,
      businessId: business.id,
      businessName: business.name,
      businessSlug: business.slug,
      timezone: business.timezone,
      currency: business.currency,
      role: membership.role,
      planId: business.subscription?.planId ?? "trial",
      subscriptionStatus: business.subscription?.status ?? "trialing",
      isSuspended: suspended,
      isPlatformAdmin: (session.user as { role?: string }).role === "admin",
    },
  };
}

/**
 * Server-component variant: returns null instead of a response so pages can
 * redirect. Never use this to authorize a mutation.
 */
export async function getTenantContext(businessId?: string | null): Promise<TenantContext | null> {
  const gate = await requireTenant({ businessId });
  return gate.ok ? gate.ctx : null;
}

/** Every workspace the signed-in user can switch into. */
export async function listWorkspaces(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { business: { select: { id: true, name: true, slug: true, status: true } } },
  });
  return memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    slug: m.business.slug,
    status: m.business.status,
    role: m.role,
    isDefault: m.isDefault,
  }));
}

/** Platform-staff gate for the SlamAI admin panel. Separate from tenancy. */
export async function requirePlatformAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) return deny("You need to sign in.", 401);
  // Re-read the role from the database: a JWT minted before a demotion would
  // still carry the old claim.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") return deny("Not found.", 404);
  return { ok: true, userId: session.user.id };
}

/**
 * Confirms a record belongs to the caller's tenant before it is used.
 * Prefer a `where: { id, businessId }` filter; use this when you already hold
 * a record and need to assert ownership.
 */
export function assertOwned<T extends { businessId: string }>(
  record: T | null,
  businessId: string
): T | null {
  if (!record || record.businessId !== businessId) return null;
  return record;
}
