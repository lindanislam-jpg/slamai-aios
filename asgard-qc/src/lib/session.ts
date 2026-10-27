import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { permissionsFor, type Actor } from "./permissions";
import { getSetting } from "./settings";

export const SESSION_COOKIE = "asgard_session";
export const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 10;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export class LoginError extends Error {}

/** Check credentials with lockout after repeated failures. Returns a new
 *  session token for the cookie. The error message never reveals whether the
 *  email exists. */
export async function login(emailRaw: string, password: string, userAgent?: string) {
  const email = emailRaw.trim().toLowerCase();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const failures = await db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } });
  if (failures >= MAX_FAILED_ATTEMPTS) {
    throw new LoginError(`Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always run a bcrypt compare so response time does not reveal valid emails.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  const success = !!user && user.active && ok;
  await db.loginAttempt.create({ data: { email, success } });
  if (!success) throw new LoginError("Incorrect email or password.");

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000),
        userAgent: userAgent?.slice(0, 200),
      },
    }),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    db.auditEvent.create({
      data: { actorId: user.id, actorName: user.name, action: "auth.login", entityType: "User", entityId: user.id },
    }),
  ]);
  return { token, expires: new Date(Date.now() + SESSION_HOURS * 3_600_000) };
}

export async function resolveSession(token: string | undefined | null): Promise<Actor | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return actorFromUser(session.user);
}

export async function actorFromUser(user: { id: string; name: string; email: string; role: Actor["role"] }): Promise<Actor> {
  const overrides = await getSetting("rolePermissions");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: permissionsFor(user.role, overrides),
  };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Revoke every session for a user — used on password change or deactivation. */
export async function revokeUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
