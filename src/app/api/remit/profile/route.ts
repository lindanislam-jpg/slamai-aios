import { db } from "@/lib/db";
import { jsonOk, parseBody, route } from "@/remit/server/api";
import { requireCustomer } from "@/remit/server/auth";
import { recordAudit } from "@/remit/server/audit";
import { updateProfileSchema } from "@/remit/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/remit/profile — the signed-in customer's profile and status. */
export const GET = route(async () => {
  const customer = await requireCustomer();
  return jsonOk({ profile: serializeProfile(customer) });
});

/** PATCH /api/remit/profile — update the customer's own details. */
export const PATCH = route(async (request) => {
  const customer = await requireCustomer();
  const input = await parseBody(request, updateProfileSchema);

  const updated = await db.remitCustomer.update({
    where: { id: customer.id },
    data: {
      fullName: input.fullName ?? undefined,
      phone: input.phone === "" ? null : (input.phone ?? undefined),
      addressLine1: input.addressLine1 ?? undefined,
      addressLine2: input.addressLine2 ?? undefined,
      city: input.city ?? undefined,
      postalCode: input.postalCode ?? undefined,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      // Changing a phone number invalidates its verification.
      phoneVerifiedAt: input.phone && input.phone !== customer.phone ? null : undefined,
    },
  });

  await recordAudit({
    actorType: "CUSTOMER",
    actorId: customer.id,
    action: "profile.updated",
    entityType: "RemitCustomer",
    entityId: customer.id,
    metadata: { fields: Object.keys(input) },
  });

  return jsonOk({ profile: serializeProfile(updated) });
});

function serializeProfile(customer: Awaited<ReturnType<typeof requireCustomer>>) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    countryCode: customer.countryCode,
    status: customer.status,
    kycStatus: customer.kycStatus,
    emailVerified: Boolean(customer.emailVerifiedAt),
    phoneVerified: Boolean(customer.phoneVerifiedAt),
    isDemo: customer.isDemo,
    address: {
      line1: customer.addressLine1,
      line2: customer.addressLine2,
      city: customer.city,
      postalCode: customer.postalCode,
    },
    dateOfBirth: customer.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    createdAt: customer.createdAt.toISOString(),
  };
}
