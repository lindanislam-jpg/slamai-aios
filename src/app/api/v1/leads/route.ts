import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, serverError, parseBody, pagination, paged, queryParam } from "@/lib/voice/http";
import { leadSchema } from "@/lib/voice/validation";
import { upsertCustomer } from "@/lib/voice/conversation";
import { recordAudit } from "@/lib/voice/audit";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "leads.read" });
  if (!gate.ok) return gate.response;

  const page = pagination(req);
  const status = queryParam(req, "status");
  const band = queryParam(req, "band");
  const search = queryParam(req, "q");

  const where: Prisma.LeadWhereInput = {
    businessId: gate.ctx.businessId,
    ...(status && status !== "all" && { status }),
    ...(band === "hot" && { score: { gte: 75 } }),
    ...(band === "warm" && { score: { gte: 45, lt: 75 } }),
    ...(band === "cold" && { score: { lt: 45 } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { serviceRequested: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  try {
    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: page.skip,
        take: page.take,
        include: { call: { select: { id: true, startedAt: true, durationSec: true } } },
      }),
      db.lead.count({ where }),
    ]);

    return ok(paged(leads, total, page));
  } catch (err) {
    return serverError("leads.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "leads.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, leadSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const customer = await upsertCustomer(gate.ctx.businessId, {
      name: input.name || undefined,
      phone: input.phone || undefined,
      email: input.email || undefined,
    });

    const lead = await db.lead.create({
      data: {
        businessId: gate.ctx.businessId,
        customerId: customer?.id ?? null,
        name: input.name || null,
        phone: input.phone || null,
        email: input.email || null,
        company: input.company || null,
        serviceRequested: input.serviceRequested || null,
        summary: input.summary || null,
        score: input.score ?? 0,
        status: input.status ?? "new",
        source: "manual",
        estimatedValue: input.estimatedValue ?? null,
        urgency: input.urgency ?? "normal",
        notes: input.notes || null,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "lead.created",
      entityType: "lead",
      entityId: lead.id,
      req,
    });

    return ok({ lead }, 201);
  } catch (err) {
    return serverError("leads.post", err);
  }
}
