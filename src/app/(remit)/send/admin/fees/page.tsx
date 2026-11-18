import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { Money } from "@/remit/money/money";
import { FeeManager } from "@/components/remit/FeeManager";
import { PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fees" };

export default async function AdminFeesPage() {
  await requireAdmin(PERMISSIONS.MANAGE_FEES);

  const [rules, corridors] = await Promise.all([
    db.remitFeeRule.findMany({
      include: { corridor: { select: { sourceCountryCode: true, destCountryCode: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    db.remitCorridor.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const format = (minor: bigint | null, currency: string) =>
    minor === null ? null : Money.fromMinor(minor, currency).format();

  return (
    <div>
      <PageHeader
        title="Fees"
        description="The transfer fee is configuration, not code. Changing a rule here changes every future quote immediately."
      />
      <FeeManager
        rules={rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          corridor: rule.corridor
            ? `${rule.corridor.sourceCountryCode} → ${rule.corridor.destCountryCode}`
            : "All corridors",
          corridorId: rule.corridorId,
          segment: rule.segment,
          promoCode: rule.promoCode,
          fixedFee: Money.fromMinor(rule.fixedFeeMinor, rule.currency).format(),
          percentageBps: rule.percentageBps,
          minAmount: format(rule.minAmountMinor, rule.currency),
          maxAmount: format(rule.maxAmountMinor, rule.currency),
          priority: rule.priority,
          isActive: rule.isActive,
        }))}
        corridors={corridors.map((corridor) => ({
          id: corridor.id,
          label: `${corridor.sourceCountryCode} → ${corridor.destCountryCode}`,
        }))}
      />
    </div>
  );
}
