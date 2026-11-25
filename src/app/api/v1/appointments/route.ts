import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, conflict, forbidden, serverError, parseBody, queryParam } from "@/lib/voice/http";
import { appointmentSchema } from "@/lib/voice/validation";
import { isSlotFree } from "@/lib/voice/availability";
import { upsertCustomer } from "@/lib/voice/conversation";
import { getVoicePlan, isWithinLimit } from "@/lib/voice/plans";
import { recordUsage, periodKey } from "@/lib/voice/usage";
import { recordAudit } from "@/lib/voice/audit";
import { notify } from "@/lib/voice/notifications";

export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "appointments.read" });
  if (!gate.ok) return gate.response;

  const from = queryParam(req, "from");
  const to = queryParam(req, "to");
  const status = queryParam(req, "status");

  try {
    const appointments = await db.appointment.findMany({
      where: {
        businessId: gate.ctx.businessId,
        ...(status && status !== "all" && { status }),
        ...((from || to) && {
          startsAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }),
      },
      orderBy: { startsAt: "asc" },
      take: 500,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMin: true } },
        call: { select: { id: true } },
      },
    });
    return ok({ appointments, timezone: gate.ctx.timezone });
  } catch (err) {
    return serverError("appointments.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "appointments.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, appointmentSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const plan = getVoicePlan(gate.ctx.planId);
    const booked = await db.usageEvent.aggregate({
      where: { businessId: gate.ctx.businessId, metric: "appointments", period: periodKey() },
      _sum: { quantity: true },
    });
    if (!isWithinLimit(plan.limits.appointments, booked._sum.quantity ?? 0)) {
      return forbidden(`Your ${plan.name} plan includes ${plan.limits.appointments} appointments a month. Upgrade to book more.`);
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) return badRequest("That start time isn't valid.");

    const service = input.serviceId
      ? await db.service.findFirst({ where: { id: input.serviceId, businessId: gate.ctx.businessId } })
      : null;

    const endsAt = input.endsAt
      ? new Date(input.endsAt)
      : new Date(startsAt.getTime() + (service?.durationMin ?? 60) * 60_000);

    if (endsAt <= startsAt) return badRequest("The end time must be after the start time.");

    if (!(await isSlotFree(gate.ctx.businessId, startsAt, endsAt))) {
      return conflict("Something else is already booked at that time.");
    }

    const customer =
      input.customerId
        ? await db.customer.findFirst({ where: { id: input.customerId, businessId: gate.ctx.businessId } })
        : await upsertCustomer(gate.ctx.businessId, {
            name: input.customerName || undefined,
            phone: input.customerPhone || undefined,
          });

    const appointment = await db.appointment.create({
      data: {
        businessId: gate.ctx.businessId,
        customerId: customer?.id ?? null,
        serviceId: service?.id ?? null,
        title: input.title,
        startsAt,
        endsAt,
        status: input.status ?? "confirmed",
        notes: input.notes || null,
      },
      include: { customer: true, service: true },
    });

    void recordUsage(gate.ctx.businessId, "appointments", 1, appointment.id);
    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "appointment.created",
      entityType: "appointment",
      entityId: appointment.id,
      req,
    });
    void notify({
      businessId: gate.ctx.businessId,
      event: "appointment.booked",
      title: `Appointment booked — ${appointment.title}`,
      body: appointment.startsAt.toISOString(),
      data: { appointmentId: appointment.id },
    });

    return ok({ appointment }, 201);
  } catch (err) {
    return serverError("appointments.post", err);
  }
}
