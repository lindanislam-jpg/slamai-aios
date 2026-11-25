import "server-only";
import { db } from "@/lib/db";
import { uniqueSlug } from "./slug";
import { DEFAULT_HOURS } from "./hours";
import { getIndustry } from "./industries";
import { countryDefaults } from "./hours";
import { TRIAL_DAYS } from "./plans";

/**
 * Creates a complete, usable workspace in one transaction: the business, the
 * owner's membership, a trial subscription, opening hours, a starter service
 * list for their trade, and a draft AI receptionist.
 *
 * A half-provisioned tenant is worse than none, so this is all-or-nothing.
 */
export async function provisionBusiness(input: {
  userId: string;
  name: string;
  industry: string;
  phone?: string | null;
  email?: string | null;
  country?: string;
  timezone?: string;
  isDemo?: boolean;
}) {
  const industry = getIndustry(input.industry);
  const defaults = countryDefaults(input.country ?? "IE");
  const slug = await uniqueSlug(input.name);

  return db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.name,
        slug,
        industry: industry.key,
        phone: input.phone ?? null,
        email: input.email ?? null,
        country: defaults.code,
        timezone: input.timezone || defaults.timezone,
        currency: defaults.currency,
        isDemo: input.isDemo ?? false,
      },
    });

    await tx.membership.create({
      data: { userId: input.userId, businessId: business.id, role: "owner", isDefault: true },
    });

    await tx.subscription.create({
      data: {
        businessId: business.id,
        planId: "trial",
        status: "trialing",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60_000),
      },
    });

    await tx.businessHour.createMany({
      data: DEFAULT_HOURS.map((h) => ({ ...h, businessId: business.id })),
    });

    await tx.service.createMany({
      data: industry.services.map((s, index) => ({
        businessId: business.id,
        name: s.name,
        durationMin: s.durationMin,
        sortOrder: index,
      })),
    });

    const agent = await tx.receptionAgent.create({
      data: {
        businessId: business.id,
        name: "AI Receptionist",
        greeting: `Hi, thanks for calling ${input.name}. I'm the AI assistant here — how can I help you today?`,
        isDefault: true,
        isActive: false,
      },
    });

    // Email the owner when something needs them, out of the box.
    if (input.email) {
      await tx.notificationRule.createMany({
        data: (["lead.created", "call.emergency", "appointment.booked"] as const).map((event) => ({
          businessId: business.id,
          event,
          channel: "email",
          target: input.email as string,
        })),
      });
    }

    return { business, agent };
  });
}
