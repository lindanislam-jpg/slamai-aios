import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/voice/tenant";
import { ok, serverError, parseBody, pagination, paged } from "@/lib/voice/http";
import { z } from "zod";

export async function GET(req: Request) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const page = pagination(req);
  try {
    const [requests, total] = await Promise.all([
      db.demoRequest.findMany({ orderBy: { createdAt: "desc" }, skip: page.skip, take: page.take }),
      db.demoRequest.count(),
    ]);
    return ok(paged(requests, total, page));
  } catch (err) {
    return serverError("admin.demo-requests", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.response;

  const body = await parseBody(
    req,
    z.object({
      id: z.string().cuid(),
      status: z.enum(["new", "contacted", "booked", "won", "lost"]),
    })
  );
  if (!body.ok) return body.response;

  try {
    const request = await db.demoRequest.update({
      where: { id: body.data.id },
      data: { status: body.data.status },
    });
    return ok({ request });
  } catch (err) {
    return serverError("admin.demo-requests.patch", err);
  }
}
