import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/remit/server/auth";
import { serializeCorridor } from "@/remit/server/serialize";
import { RateCalculator } from "@/components/remit/RateCalculator";
import { Card, PageHeader, SandboxBadge } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rates" };

export default async function SendRatesPage() {
  await requireCustomer();

  const [corridors, recentRates] = await Promise.all([
    db.remitCorridor.findMany({
      where: { isActive: true },
      include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
    }),
    db.remitExchangeRate.findMany({ orderBy: { fetchedAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rates"
        description="Check what your recipient would get before you commit to anything."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <RateCalculator
          corridors={corridors.map(serializeCorridor)}
          ctaHref="/send/new"
          ctaLabel="Send at this rate"
        />

        <div className="space-y-4">
          <Card>
            <h2 className="text-[15px] font-bold text-send-ink">How our pricing works</h2>
            <dl className="mt-3 space-y-3 text-[13px] leading-relaxed">
              {[
                ["Market rate", "The mid-market rate our FX provider gives us. We publish it."],
                ["Our FX margin", "What we add on top. Currently zero on Ireland → South Africa."],
                ["Your rate", "Market rate less our margin. This is what converts your money."],
                ["Transfer fee", "A flat charge, shown separately, that never scales with the amount."],
              ].map(([term, definition]) => (
                <div key={term}>
                  <dt className="font-bold text-send-ink">{term}</dt>
                  <dd className="text-send-body">{definition}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-send-ink">Recent rates observed</h2>
              <SandboxBadge />
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-send-muted">
              A log of what the rate provider returned. These are indicative sandbox values, not
              market rates.
            </p>
            <ul className="mt-3 divide-y divide-send-line">
              {recentRates.map((rate) => (
                <li key={rate.id} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span className="font-semibold text-send-ink">
                    {rate.baseCurrency}/{rate.quoteCurrency}
                  </span>
                  <span className="tnum font-bold text-send-ink">
                    {Number(rate.marketRate).toFixed(4)}
                  </span>
                  <span className="tnum text-send-muted">
                    {rate.fetchedAt.toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
              {recentRates.length === 0 && (
                <li className="py-3 text-[13px] text-send-muted">
                  No rates observed yet. Price a transfer to populate this.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
