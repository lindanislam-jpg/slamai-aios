import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, pagination, paged, queryParam } from "@/lib/voice/http";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "calls.read" });
  if (!gate.ok) return gate.response;

  const page = pagination(req);
  const outcome = queryParam(req, "outcome");
  const search = queryParam(req, "q");
  const agentId = queryParam(req, "agentId");

  const where: Prisma.VoiceCallWhereInput = {
    businessId: gate.ctx.businessId,
    ...(outcome && outcome !== "all" && { outcome }),
    ...(agentId && { agentId }),
    ...(search && {
      OR: [
        { fromNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  try {
    const [calls, total] = await Promise.all([
      db.voiceCall.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: page.skip,
        take: page.take,
        select: {
          id: true, fromNumber: true, startedAt: true, durationSec: true, status: true,
          outcome: true, summary: true, sentiment: true, aiHandled: true, transferred: true,
          isEmergency: true, afterHours: true,
          agent: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          lead: { select: { id: true, score: true, status: true } },
        },
      }),
      db.voiceCall.count({ where }),
    ]);

    return ok(paged(calls, total, page));
  } catch (err) {
    return serverError("calls.get", err);
  }
}
