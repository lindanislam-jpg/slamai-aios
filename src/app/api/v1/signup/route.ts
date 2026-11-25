import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, badRequest, conflict, serverError, parseBody } from "@/lib/voice/http";
import { signupSchema } from "@/lib/voice/validation";
import { provisionBusiness } from "@/lib/voice/provisioning";
import { hit, limitKey } from "@/lib/voice/rate-limit";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";

/**
 * Creates the account and its workspace together — a business owner never has
 * a login without somewhere to log in to.
 */
export async function POST(req: Request) {
  const limit = hit(limitKey("voice:signup", req), 5, 900);
  if (!limit.allowed) {
    return badRequest(`Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`);
  }

  const body = await parseBody(req, signupSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const email = input.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return conflict("An account with that email already exists. Sign in instead.");
    }

    const user = await db.user.create({
      data: {
        email,
        name: input.name,
        password: await bcrypt.hash(input.password, 12),
        company: input.businessName,
      },
    });

    const { business } = await provisionBusiness({
      userId: user.id,
      name: input.businessName,
      industry: input.industry,
      phone: input.phone || null,
      email,
      country: input.country,
      timezone: input.timezone,
    });

    await recordAudit({
      businessId: business.id,
      userId: user.id,
      action: "workspace.created",
      entityType: "business",
      entityId: business.id,
      req,
    });

    return ok({ businessId: business.id, businessName: business.name }, 201);
  } catch (err) {
    return serverError("signup", err);
  }
}
