import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, forbidden, serverError, pagination, paged } from "@/lib/voice/http";
import { planAllows } from "@/lib/voice/plans";

export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "audit.read" });
  if (!gate.ok) return gate.response;

  if (!planAllows(gate.ctx.planId, "audit_log")) {
    return forbidden("The audit log is available on the Business plan and above.");
  }

  const page = pagination(req);
  const where = { businessId: gate.ctx.businessId };

  try {
    const [entries, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ]);

    return ok(paged(entries, total, page));
  } catch (err) {
    return serverError("audit", err);
  }
}
