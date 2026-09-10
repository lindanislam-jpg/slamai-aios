import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, queryParam } from "@/lib/voice/http";
import { findSlots } from "@/lib/voice/availability";
import { DEFAULT_HOURS, type HourRow } from "@/lib/voice/hours";

/** The same slot finder the AI uses on a call, so the two never disagree. */
export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "appointments.read" });
  if (!gate.ok) return gate.response;

  const serviceId = queryParam(req, "serviceId");
  const date = queryParam(req, "date");

  try {
    const [hours, service] = await Promise.all([
      db.businessHour.findMany({ where: { businessId: gate.ctx.businessId } }),
      serviceId
        ? db.service.findFirst({ where: { id: serviceId, businessId: gate.ctx.businessId } })
        : null,
    ]);

    const rows: HourRow[] =
      hours.length === 7
        ? hours.map((h) => ({ weekday: h.weekday, isOpen: h.isOpen, opensAt: h.opensAt, closesAt: h.closesAt }))
        : DEFAULT_HOURS;

    const onDate = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    const slots = await findSlots(gate.ctx.businessId, {
      hours: rows,
      timezone: gate.ctx.timezone,
      durationMin: service?.durationMin ?? 60,
      limit: 12,
      ...(onDate && {
        onDate: { year: Number(onDate[1]), month: Number(onDate[2]), day: Number(onDate[3]) },
      }),
    });

    return ok({ slots, timezone: gate.ctx.timezone });
  } catch (err) {
    return serverError("appointments.availability", err);
  }
}
