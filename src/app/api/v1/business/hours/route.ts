import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody } from "@/lib/voice/http";
import { hoursSchema } from "@/lib/voice/validation";
import { recordAudit } from "@/lib/voice/audit";

export async function GET() {
  const gate = await requireTenant({ permission: "business.read" });
  if (!gate.ok) return gate.response;

  try {
    const hours = await db.businessHour.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: { weekday: "asc" },
    });
    return ok({ hours });
  } catch (err) {
    return serverError("hours.get", err);
  }
}

/** Replaces the whole week at once, so a partial save cannot leave gaps. */
export async function PUT(req: Request) {
  const gate = await requireTenant({ permission: "business.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, hoursSchema);
  if (!body.ok) return body.response;

  try {
    await db.$transaction(
      body.data.hours.map((h) =>
        db.businessHour.upsert({
          where: { businessId_weekday: { businessId: gate.ctx.businessId, weekday: h.weekday } },
          update: { isOpen: h.isOpen, opensAt: h.opensAt, closesAt: h.closesAt },
          create: { businessId: gate.ctx.businessId, ...h },
        })
      )
    );

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "hours.updated",
      req,
    });

    return ok({ hours: body.data.hours });
  } catch (err) {
    return serverError("hours.put", err);
  }
}
