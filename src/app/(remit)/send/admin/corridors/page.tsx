import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { Money } from "@/remit/money/money";
import { CorridorManager } from "@/components/remit/CorridorManager";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Corridors" };

export default async function AdminCorridorsPage() {
  await requireAdmin(PERMISSIONS.MANAGE_CORRIDORS);

  const corridors = await db.remitCorridor.findMany({
    include: {
      sourceCountry: true,
      destCountry: true,
      paymentOptions: true,
      payoutOptions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Corridors"
        description="Supported routes, their limits and their providers. Adding a country is a row here, not a code change."
      />
      <CorridorManager
        corridors={corridors.map((corridor) => ({
          id: corridor.id,
          label: `${corridor.sourceCountry.flagEmoji} ${corridor.sourceCountry.name} → ${corridor.destCountry.flagEmoji} ${corridor.destCountry.name}`,
          pair: `${corridor.sourceCurrency} → ${corridor.destCurrency}`,
          isActive: corridor.isActive,
          isLive: corridor.isLive,
          fxMarginBps: corridor.fxMarginBps,
          minAmount: Money.fromMinor(corridor.minAmountMinor, corridor.sourceCurrency).toDecimalString(),
          maxAmount: Money.fromMinor(corridor.maxAmountMinor, corridor.sourceCurrency).toDecimalString(),
          dailyLimit: Money.fromMinor(corridor.dailyLimitMinor, corridor.sourceCurrency).toDecimalString(),
          monthlyLimit: Money.fromMinor(corridor.monthlyLimitMinor, corridor.sourceCurrency).toDecimalString(),
          destRiskBand: corridor.destCountry.riskBand,
          fxProviderKey: corridor.fxProviderKey,
          payoutProviderKey: corridor.payoutProviderKey,
          paymentMethods: corridor.paymentOptions
            .filter((option) => option.isEnabled)
            .map((option) => option.method),
          payoutMethods: corridor.payoutOptions
            .filter((option) => option.isEnabled)
            .map((option) => option.method),
        }))}
      />
    </div>
  );
}
