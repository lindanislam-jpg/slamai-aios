import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, badRequest, forbidden, serverError, parseBody } from "@/lib/voice/http";
import { z } from "zod";
import { canAssignRole, isRole } from "@/lib/voice/roles";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

const roleSchema = z.object({ role: z.string() });

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "team.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, roleSchema);
  if (!body.ok) return body.response;
  const { role } = body.data;

  if (!isRole(role)) return badRequest("That isn't a valid role.");
  if (!canAssignRole(gate.ctx.role, role)) {
    return forbidden("You cannot assign a role at or above your own.");
  }

  try {
    const membership = await db.membership.findFirst({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (!membership) return notFound("That team member is no longer in this workspace.");

    // Removing the last owner would lock the workspace out of its own billing.
    if (membership.role === "owner" && role !== "owner") {
      const owners = await db.membership.count({
        where: { businessId: gate.ctx.businessId, role: "owner" },
      });
      if (owners <= 1) return badRequest("A workspace needs at least one owner.");
    }

    const updated = await db.membership.update({ where: { id }, data: { role } });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "team.role_changed",
      entityType: "membership",
      entityId: id,
      metadata: { from: membership.role, to: role },
      req,
    });

    return ok({ membership: updated });
  } catch (err) {
    return serverError("team.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "team.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const membership = await db.membership.findFirst({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (!membership) return notFound("That team member is no longer in this workspace.");

    if (membership.role === "owner") {
      const owners = await db.membership.count({
        where: { businessId: gate.ctx.businessId, role: "owner" },
      });
      if (owners <= 1) return badRequest("A workspace needs at least one owner.");
    }
    if (!canAssignRole(gate.ctx.role, membership.role) && membership.userId !== gate.ctx.userId) {
      return forbidden("You cannot remove someone at or above your own role.");
    }

    await db.membership.delete({ where: { id } });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "team.member_removed",
      entityType: "membership",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("team.delete", err);
  }
}
