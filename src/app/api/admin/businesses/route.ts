import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/voice/tenant";
import { ok, serverError, pagination, paged, queryParam } from "@/lib/voice/http";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const page = pagination(req);
  const search = queryParam(req, "q");
  const status = queryParam(req, "status");

  const where: Prisma.BusinessWhereInput = {
    ...(status && status !== "all" && { status }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  try {
    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
        include: {
          subscription: true,
          _count: { select: { calls: true, leads: true, memberships: true, phoneNumbers: true } },
          memberships: {
            where: { role: "owner" },
            take: 1,
            include: { user: { select: { email: true, name: true } } },
          },
        },
      }),
      db.business.count({ where }),
    ]);

    return ok(paged(businesses, total, page));
  } catch (err) {
    return serverError("admin.businesses", err);
  }
}
