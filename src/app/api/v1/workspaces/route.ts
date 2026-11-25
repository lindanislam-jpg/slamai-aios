import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, serverError, parseBody } from "@/lib/voice/http";
import { listWorkspaces } from "@/lib/voice/tenant";
import { z } from "zod";

/** The workspaces this user can switch between. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return fail("You need to sign in.", 401);

  try {
    return ok({ workspaces: await listWorkspaces(session.user.id) });
  } catch (err) {
    return serverError("workspaces", err);
  }
}

/** Sets which workspace the user lands in. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("You need to sign in.", 401);

  const body = await parseBody(req, z.object({ businessId: z.string().cuid() }));
  if (!body.ok) return body.response;

  try {
    // The membership lookup is what proves the user may switch here.
    const membership = await db.membership.findUnique({
      where: { userId_businessId: { userId: session.user.id, businessId: body.data.businessId } },
    });
    if (!membership) return fail("You're not a member of that workspace.", 403);

    await db.$transaction([
      db.membership.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      }),
      db.membership.update({ where: { id: membership.id }, data: { isDefault: true } }),
    ]);

    return ok({ businessId: body.data.businessId });
  } catch (err) {
    return serverError("workspaces.patch", err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  industry: z.string().trim().max(60).default("other"),
  country: z.string().trim().length(2).default("IE"),
  timezone: z.string().trim().min(3).max(64).default("Europe/Dublin"),
});

/** Creates an additional workspace for the signed-in user. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("You need to sign in.", 401);

  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  try {
    const { provisionBusiness } = await import("@/lib/voice/provisioning");
    const { business } = await provisionBusiness({
      userId: session.user.id,
      name: body.data.name,
      industry: body.data.industry,
      email: session.user.email ?? null,
      country: body.data.country,
      timezone: body.data.timezone,
    });

    // Land the user in the workspace they just created.
    await db.membership.updateMany({
      where: { userId: session.user.id, businessId: { not: business.id } },
      data: { isDefault: false },
    });

    return ok({ businessId: business.id, name: business.name }, 201);
  } catch (err) {
    return serverError("workspaces.post", err);
  }
}
