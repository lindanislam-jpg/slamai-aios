import { db } from "@/lib/db";
import { badRequest, clientIp, jsonOk, parseBody, route, userAgent } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { serializeRecipient } from "@/remit/server/serialize";
import { validateRecipientDetails } from "@/remit/corridors/recipient-schema";
import { createRecipientSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/remit/recipients — the customer's saved recipients. */
export const GET = route(async () => {
  const customer = await requireActiveCustomer();
  const recipients = await db.remitRecipient.findMany({
    where: { customerId: customer.id, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ recipients: recipients.map(serializeRecipient) });
});

/**
 * POST /api/remit/recipients
 *
 * `details` is validated against the destination country's payout schema with
 * a strict object, so unexpected fields are rejected rather than stored.
 */
export const POST = route(async (request) => {
  const customer = await requireActiveCustomer();
  const input = await parseBody(request, createRecipientSchema);

  const country = await db.remitCountry.findUnique({ where: { code: input.destCountryCode } });
  if (!country?.canReceive) throw badRequest("We do not send to that country yet");

  const { details, fullName } = validateRecipientDetails(
    input.destCountryCode,
    input.payoutMethod,
    input.details,
  );

  const recipient = await db.remitRecipient.create({
    data: {
      customerId: customer.id,
      nickname: input.nickname || null,
      fullName,
      destCountryCode: input.destCountryCode,
      destCurrency: country.currencyCode,
      payoutMethod: input.payoutMethod,
      details,
    },
  });

  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: "recipient.created",
    entityType: "RemitRecipient",
    entityId: recipient.id,
    // Account details are never written to the audit log.
    metadata: { destCountryCode: recipient.destCountryCode, payoutMethod: recipient.payoutMethod },
    ipAddress: clientIp(request),
    userAgent: userAgent(request),
  });

  return jsonOk({ recipient: serializeRecipient(recipient) }, 201);
});
