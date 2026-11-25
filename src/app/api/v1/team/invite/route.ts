import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, conflict, forbidden, serverError, parseBody } from "@/lib/voice/http";
import { inviteSchema } from "@/lib/voice/validation";
import { canAssignRole } from "@/lib/voice/roles";
import { getVoicePlan, isWithinLimit } from "@/lib/voice/plans";
import { recordAudit } from "@/lib/voice/audit";
import { isEmailConfigured } from "@/lib/voice/notifications";

export const runtime = "nodejs";

const TTL_DAYS = 7;

/**
 * Invites a teammate. Only the token hash is stored, so the database never
 * holds a usable invitation link.
 */
export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "team.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, inviteSchema);
  if (!body.ok) return body.response;
  const { email, role } = body.data;

  if (!canAssignRole(gate.ctx.role, role)) {
    return forbidden("You cannot invite someone at that role level.");
  }

  try {
    const plan = getVoicePlan(gate.ctx.planId);
    const [members, pending] = await Promise.all([
      db.membership.count({ where: { businessId: gate.ctx.businessId } }),
      db.invitation.count({ where: { businessId: gate.ctx.businessId, acceptedAt: null } }),
    ]);
    if (!isWithinLimit(plan.limits.seats, members + pending)) {
      return forbidden(`Your ${plan.name} plan includes ${plan.limits.seats} seats. Upgrade to add more.`);
    }

    const normalised = email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email: normalised }, select: { id: true } });
    if (existing) {
      const already = await db.membership.findUnique({
        where: { userId_businessId: { userId: existing.id, businessId: gate.ctx.businessId } },
      });
      if (already) return conflict("They're already on your team.");

      // The account exists, so add them directly — an invite email would only
      // send them somewhere they can already reach.
      await db.membership.create({
        data: { userId: existing.id, businessId: gate.ctx.businessId, role },
      });
      await recordAudit({
        businessId: gate.ctx.businessId,
        userId: gate.ctx.userId,
        action: "team.member_added",
        entityType: "membership",
        metadata: { email: normalised, role },
        req,
      });
      return ok({ added: true, email: normalised }, 201);
    }

    const token = randomBytes(32).toString("hex");
    const invitation = await db.invitation.upsert({
      where: { businessId_email: { businessId: gate.ctx.businessId, email: normalised } },
      update: {
        role,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60_000),
        acceptedAt: null,
        invitedById: gate.ctx.userId,
      },
      create: {
        businessId: gate.ctx.businessId,
        email: normalised,
        role,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60_000),
        invitedById: gate.ctx.userId,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "team.invited",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: normalised, role },
      req,
    });

    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    const link = `${base}/accept-invite?token=${token}`;

    // Without a mail provider the link is returned so the owner can send it
    // themselves — better than an invitation that silently never arrives.
    return ok(
      {
        invitation: { id: invitation.id, email: normalised, role },
        emailSent: false,
        inviteLink: link,
        note: isEmailConfigured()
          ? "Copy this link to your teammate."
          : "No email provider is configured, so send this link to your teammate yourself.",
      },
      201
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return badRequest("There's already a pending invitation for that address.");
    }
    return serverError("team.invite", err);
  }
}
