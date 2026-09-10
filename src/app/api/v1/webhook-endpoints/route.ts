import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, forbidden, serverError, parseBody } from "@/lib/voice/http";
import { webhookEndpointSchema } from "@/lib/voice/validation";
import { generateSecret } from "@/lib/voice/signing";
import { planAllows } from "@/lib/voice/plans";
import { recordAudit } from "@/lib/voice/audit";
import { isPrivateHost } from "@/lib/voice/extract";

export async function GET() {
  const gate = await requireTenant({ permission: "integrations.read" });
  if (!gate.ok) return gate.response;

  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: { createdAt: "desc" },
      // The secret is shown once at creation and never again.
      select: {
        id: true, name: true, url: true, events: true, isActive: true,
        lastStatus: true, lastFiredAt: true, failureCount: true, createdAt: true,
      },
    });
    return ok({ endpoints, enabled: planAllows(gate.ctx.planId, "webhooks") });
  } catch (err) {
    return serverError("webhooks.get", err);
  }
}

export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "integrations.write", write: true });
  if (!gate.ok) return gate.response;

  if (!planAllows(gate.ctx.planId, "webhooks")) {
    return forbidden("Webhooks are available on the Business plan and above.");
  }

  const body = await parseBody(req, webhookEndpointSchema);
  if (!body.ok) return body.response;

  // A webhook URL is a server-side fetch target, so it must be public.
  try {
    if (isPrivateHost(new URL(body.data.url).hostname)) {
      return forbidden("Use a publicly reachable https address.");
    }
  } catch {
    return forbidden("That URL isn't valid.");
  }

  try {
    const secret = generateSecret();
    const endpoint = await db.webhookEndpoint.create({
      data: {
        businessId: gate.ctx.businessId,
        name: body.data.name,
        url: body.data.url,
        events: JSON.stringify(body.data.events),
        isActive: body.data.isActive,
        secret,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "webhook.created",
      entityType: "webhook_endpoint",
      entityId: endpoint.id,
      req,
    });

    return ok(
      {
        endpoint: { id: endpoint.id, name: endpoint.name, url: endpoint.url, events: endpoint.events },
        secret,
        note: "Copy this signing secret now — it is not shown again.",
      },
      201
    );
  } catch (err) {
    return serverError("webhooks.post", err);
  }
}
