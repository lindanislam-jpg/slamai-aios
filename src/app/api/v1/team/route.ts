import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError } from "@/lib/voice/http";

export async function GET() {
  const gate = await requireTenant({ permission: "team.read" });
  if (!gate.ok) return gate.response;

  try {
    const [members, invitations] = await Promise.all([
      db.membership.findMany({
        where: { businessId: gate.ctx.businessId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      }),
      db.invitation.findMany({
        where: { businessId: gate.ctx.businessId, acceptedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);

    return ok({ members, invitations, yourRole: gate.ctx.role, yourUserId: gate.ctx.userId });
  } catch (err) {
    return serverError("team.get", err);
  }
}
