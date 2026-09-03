import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";

/** How long a reset link stays usable. */
const TTL_MINUTES = 60;

/** Tokens are stored hashed, so the database never holds a usable secret. */
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset token for a user and return the raw value — the only time it
 * exists in plaintext. Any earlier unused tokens for the same user are
 * invalidated so a single link is live at a time.
 */
export async function createResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: {
        tokenHash: hash(token),
        userId,
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      },
    }),
  ]);

  return { token, expiresInMinutes: TTL_MINUTES };
}

/** Resolve a raw token to its user id, or null when it is unusable. */
export async function consumeResetToken(token: string): Promise<string | null> {
  if (!token || typeof token !== "string") return null;

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hash(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  // Constant-time comparison on the hashes, so a near-miss cannot be timed.
  const a = Buffer.from(record.tokenHash, "hex");
  const b = Buffer.from(hash(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const claimed = await db.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  // updateMany reports 0 if another request claimed it first.
  if (claimed.count !== 1) return null;

  return record.userId;
}

/** True once a real mail service is wired up. */
export function canSendEmail() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
}
