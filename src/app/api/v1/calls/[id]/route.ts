import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError } from "@/lib/voice/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "calls.read" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const call = await db.voiceCall.findFirst({
      where: { id, businessId: gate.ctx.businessId },
      include: {
        turns: { orderBy: { offsetSec: "asc" } },
        agent: { select: { id: true, name: true, voice: true } },
        customer: true,
        lead: true,
        appointments: { include: { service: { select: { name: true } } } },
      },
    });
    if (!call) return notFound("That call no longer exists.");
    return ok({ call, timezone: gate.ctx.timezone });
  } catch (err) {
    return serverError("calls.get.one", err);
  }
}
