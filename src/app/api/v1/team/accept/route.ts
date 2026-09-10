import { createHash } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/voice/http";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";

/** Redeems an invitation for the signed-in user. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return badRequest("Sign in first, then open your invitation link again.");
  }

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token;
  if (!token || typeof token !== "string") return badRequest("That invitation link is incomplete.");

  try {
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      include: { business: { select: { id: true, name: true } } },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      return badRequest("That invitation has expired or has already been used.");
    }

    // The invite is addressed to one mailbox; a different account must not
    // be able to redeem a link that was forwarded to them.
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return badRequest("That invitation was sent to a different email address.");
    }

    await db.$transaction([
      db.membership.upsert({
        where: { userId_businessId: { userId: session.user.id, businessId: invitation.businessId } },
        update: { role: invitation.role },
        create: {
          userId: session.user.id,
          businessId: invitation.businessId,
          role: invitation.role,
        },
      }),
      db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);

    await recordAudit({
      businessId: invitation.businessId,
      userId: session.user.id,
      action: "team.invitation_accepted",
      entityType: "invitation",
      entityId: invitation.id,
      req,
    });

    return ok({ businessId: invitation.businessId, businessName: invitation.business.name });
  } catch (err) {
    return serverError("team.accept", err);
  }
}
