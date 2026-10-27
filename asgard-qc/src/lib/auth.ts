import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ForbiddenError } from "./errors";
import type { Actor, Permission } from "./permissions";
import { resolveSession, SESSION_COOKIE } from "./session";

/** The signed-in user for this request, or null. Cached per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
});

/** For pages: redirect to sign-in when there is no session. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

/** For pages: show the not-authorised screen when a permission is missing. */
export async function requirePagePermission(perm: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.permissions.has(perm)) redirect("/forbidden");
  return actor;
}

/** For route handlers and server actions. */
export async function requireApiActor(perm?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new ForbiddenError("Your session has expired. Sign in again.");
  if (perm && !actor.permissions.has(perm)) throw new ForbiddenError();
  return actor;
}
