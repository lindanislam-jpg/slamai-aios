import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, badRequest, conflict, serverError, parseBody } from "@/lib/voice/http";
import { appointmentSchema } from "@/lib/voice/validation";
import { isSlotFree } from "@/lib/voice/availability";
import { recordAudit } from "@/lib/voice/audit";
import { notify } from "@/lib/voice/notifications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "appointments.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await parseBody(req, appointmentSchema.partial());
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const existing = await db.appointment.findFirst({
      where: { id, businessId: gate.ctx.businessId },
      include: { service: true },
    });
    if (!existing) return notFound("That appointment no longer exists.");

    // A service id from the client is only accepted if it belongs to this tenant.
    if (input.serviceId) {
      const service = await db.service.findFirst({
        where: { id: input.serviceId, businessId: gate.ctx.businessId },
        select: { id: true },
      });
      if (!service) return notFound("That service no longer exists.");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt
      ? new Date(input.endsAt)
      : input.startsAt
        ? new Date(startsAt.getTime() + (existing.service?.durationMin ?? 60) * 60_000)
        : existing.endsAt;

    if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      return badRequest("That time isn't valid.");
    }

    // Only re-check the calendar when the appointment is actually moving.
    const moving = startsAt.getTime() !== existing.startsAt.getTime() || endsAt.getTime() !== existing.endsAt.getTime();
    const activating = (input.status ?? existing.status) !== "cancelled";
    if (moving && activating && !(await isSlotFree(gate.ctx.businessId, startsAt, endsAt, id))) {
      return conflict("Something else is already booked at that time.");
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.serviceId !== undefined && { serviceId: input.serviceId }),
        startsAt,
        endsAt,
      },
      include: { customer: true, service: true },
    });

    const action = input.status === "cancelled" ? "appointment.cancelled" : "appointment.updated";
    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action,
      entityType: "appointment",
      entityId: id,
      req,
    });

    if (input.status === "cancelled") {
      void notify({
        businessId: gate.ctx.businessId,
        event: "appointment.cancelled",
        title: `Appointment cancelled — ${appointment.title}`,
        body: appointment.startsAt.toISOString(),
        data: { appointmentId: id },
      });
    }

    return ok({ appointment });
  } catch (err) {
    return serverError("appointments.patch", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "appointments.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.appointment.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That appointment no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "appointment.deleted",
      entityType: "appointment",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("appointments.delete", err);
  }
}
