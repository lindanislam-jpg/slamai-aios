import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, conflict, forbidden, serverError, parseBody } from "@/lib/voice/http";
import { phoneNumberSchema } from "@/lib/voice/validation";
import { getVoiceProvider, appBaseUrl, isVoiceProviderConfigured } from "@/lib/voice/providers";
import { getVoicePlan, isWithinLimit } from "@/lib/voice/plans";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireTenant({ permission: "phone.read" });
  if (!gate.ok) return gate.response;

  try {
    const numbers = await db.phoneNumber.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: { createdAt: "asc" },
      include: { agent: { select: { id: true, name: true, isActive: true } } },
    });
    return ok({
      numbers,
      providerConfigured: isVoiceProviderConfigured(),
      provider: getVoiceProvider().name,
      webhookUrl: `${appBaseUrl()}/api/webhooks/twilio/voice`,
    });
  } catch (err) {
    return serverError("numbers.get", err);
  }
}

/**
 * Attaches a number to this workspace.
 *
 * `mode: "purchase"` buys it through the provider; `mode: "connect"` registers
 * a number the business already owns. Either way the number is pointed at this
 * platform's webhook so calls actually arrive.
 */
export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "phone.write", write: true });
  if (!gate.ok) return gate.response;

  const body = await parseBody(req, phoneNumberSchema.extend({}).passthrough());
  if (!body.ok) return body.response;
  const input = body.data as typeof body.data & { mode?: string; providerSid?: string };

  try {
    const plan = getVoicePlan(gate.ctx.planId);
    const count = await db.phoneNumber.count({
      where: { businessId: gate.ctx.businessId, status: { not: "released" } },
    });
    if (!isWithinLimit(plan.limits.phoneNumbers, count)) {
      return forbidden(`Your ${plan.name} plan includes ${plan.limits.phoneNumbers} phone numbers. Upgrade to add more.`);
    }

    // A number can only ever route to one tenant, so this is the tenancy
    // boundary for inbound calls and must be checked before anything is bought.
    const taken = await db.phoneNumber.findUnique({ where: { e164: input.e164 } });
    if (taken) {
      return conflict("That number is already connected to a SlamAI workspace.");
    }

    const provider = getVoiceProvider();
    let providerSid = input.providerSid ?? null;
    let status = "pending";

    if (provider.isConfigured()) {
      const base = appBaseUrl();
      if (input.mode === "purchase") {
        const purchased = await provider.purchaseNumber(input.e164, base);
        providerSid = purchased.providerSid;
        status = "active";
      } else if (providerSid) {
        await provider.configureNumber(providerSid, base);
        status = "active";
      } else {
        // Connecting a number we can see on the account: find its id first.
        const owned = await provider.listOwnedNumbers();
        const match = owned.find((n) => n.e164 === input.e164);
        if (!match) {
          return badRequest(
            "That number isn't on the connected provider account. Buy it here, or add it to your provider account first."
          );
        }
        providerSid = match.providerSid;
        await provider.configureNumber(match.providerSid, base);
        status = "active";
      }
    }

    const agentId =
      input.agentId ??
      (await db.receptionAgent.findFirst({
        where: { businessId: gate.ctx.businessId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      }))?.id ??
      null;

    const number = await db.phoneNumber.create({
      data: {
        businessId: gate.ctx.businessId,
        e164: input.e164,
        label: input.label || null,
        provider: provider.name,
        providerSid,
        status,
        forwardTo: input.forwardTo || null,
        agentId,
      },
    });

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "phone.connected",
      entityType: "phone_number",
      entityId: number.id,
      metadata: { e164: input.e164, mode: input.mode ?? "connect" },
      req,
    });

    return ok({ number, providerConfigured: provider.isConfigured() }, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "VoiceProviderNotConfiguredError") {
      return badRequest(err.message);
    }
    return serverError("numbers.post", err);
  }
}
