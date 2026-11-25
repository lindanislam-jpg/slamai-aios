import { db } from "@/lib/db";
import { ok, badRequest, serverError, parseBody } from "@/lib/voice/http";
import { demoRequestSchema } from "@/lib/voice/validation";
import { hit, limitKey } from "@/lib/voice/rate-limit";

export const runtime = "nodejs";

/** SlamAI's own sales enquiries from the marketing site. */
export async function POST(req: Request) {
  const limit = hit(limitKey("voice:demo", req), 5, 3600);
  if (!limit.allowed) {
    return badRequest("We've already got your request. We'll be in touch shortly.");
  }

  const body = await parseBody(req, demoRequestSchema);
  if (!body.ok) return body.response;

  try {
    await db.demoRequest.create({
      data: {
        name: body.data.name,
        businessName: body.data.businessName,
        email: body.data.email.toLowerCase(),
        phone: body.data.phone || null,
        industry: body.data.industry || null,
        message: body.data.message || null,
      },
    });
    return ok({ received: true }, 201);
  } catch (err) {
    return serverError("demo-request", err);
  }
}
