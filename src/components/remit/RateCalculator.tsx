"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, SandboxBadge, SummaryRow } from "./ui";

/**
 * The landing-page calculator.
 *
 * The browser holds the amount the customer typed and nothing else. Every
 * number shown — fee, rate, recipient amount, total — is computed on the
 * server and rendered exactly as returned. There is deliberately no
 * arithmetic in this file.
 */

interface MoneyDTO {
  currency: string;
  minor: string;
  amount: string;
  formatted: string;
}

interface Preview {
  sourceAmount: MoneyDTO;
  fee: MoneyDTO;
  totalPayable: MoneyDTO;
  destAmount: MoneyDTO;
  rateDisplay: string;
  fxMarginBps: number;
  estimatedDelivery: string;
  isSandbox: boolean;
}

export interface CorridorOption {
  id: string;
  source: { countryCode: string; name: string; flag: string; currency: string };
  destination: { countryCode: string; name: string; flag: string; currency: string };
  minAmount: MoneyDTO;
  maxAmount: MoneyDTO;
  estimatedDelivery: string;
  isLive: boolean;
}

export function RateCalculator({
  corridors,
  ctaHref = "/send/register",
  ctaLabel = "Send money",
}: {
  corridors: CorridorOption[];
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [corridorIndex, setCorridorIndex] = useState(0);
  const [amount, setAmount] = useState("300");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const corridor = corridors[corridorIndex];

  const fetchPreview = useCallback(
    async (value: string) => {
      if (!corridor) return;
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) {
        setPreview(null);
        setError(value.trim() === "" ? null : "Enter an amount like 300 or 300.50");
        return;
      }

      const id = ++requestId.current;
      setLoading(true);
      try {
        const response = await fetch("/api/remit/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceCountryCode: corridor.source.countryCode,
            destCountryCode: corridor.destination.countryCode,
            sourceAmount: value,
            paymentMethod: "BANK_TRANSFER",
            payoutMethod: "BANK_DEPOSIT",
          }),
        });
        const data = await response.json();
        // Ignore a slow response that a newer keystroke has superseded.
        if (id !== requestId.current) return;

        if (!response.ok) {
          setPreview(null);
          setError(data?.error?.message ?? "We could not price that just now");
          return;
        }
        setPreview(data.preview);
        setError(null);
      } catch {
        if (id === requestId.current) setError("Check your connection and try again");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [corridor],
  );

  useEffect(() => {
    const timer = setTimeout(() => void fetchPreview(amount), 300);
    return () => clearTimeout(timer);
  }, [amount, fetchPreview]);

  if (!corridor) {
    return (
      <div className="send-card p-6">
        <Alert tone="warning">No sending routes are configured yet.</Alert>
      </div>
    );
  }

  return (
    <div className="send-card overflow-hidden p-0">
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <label
            htmlFor="calc-amount"
            className="block text-[12px] font-bold uppercase tracking-wide text-send-muted"
          >
            You send
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-send-line bg-send-canvas px-4 py-3 focus-within:border-send-primary focus-within:ring-2 focus-within:ring-send-primary/20">
            <span className="tnum text-[26px] font-bold text-send-ink">
              {currencySymbol(corridor.source.currency)}
            </span>
            <input
              id="calc-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tnum w-full bg-transparent text-[30px] font-bold text-send-ink outline-none"
              aria-describedby="calc-limits"
            />
            <span className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-send-body">
              {corridor.source.flag} {corridor.source.currency}
            </span>
          </div>
          <p id="calc-limits" className="mt-1.5 text-[12px] text-send-muted">
            {corridor.minAmount.formatted} – {corridor.maxAmount.formatted} per transfer
          </p>
        </div>

        {corridors.length > 1 && (
          <div>
            <label
              htmlFor="calc-corridor"
              className="block text-[12px] font-bold uppercase tracking-wide text-send-muted"
            >
              They receive in
            </label>
            <select
              id="calc-corridor"
              value={corridorIndex}
              onChange={(event) => setCorridorIndex(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-send-line bg-send-canvas px-4 py-3.5 text-[16px] font-semibold text-send-ink"
            >
              {corridors.map((option, index) => (
                <option key={option.id} value={index}>
                  {option.destination.flag} {option.destination.name} (
                  {option.destination.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-2xl bg-send-primary-soft px-4 py-4">
          <div className="text-[12px] font-bold uppercase tracking-wide text-send-primary">
            {corridor.destination.flag} {corridor.destination.name} receives
          </div>
          <div className="tnum mt-1 text-[32px] font-black leading-none text-send-primary">
            {preview ? preview.destAmount.formatted : loading ? "…" : "—"}
          </div>
        </div>
      </div>

      <div className="border-t border-send-line px-5 pb-5 pt-3 sm:px-6">
        {error ? (
          <Alert tone="warning">{error}</Alert>
        ) : (
          <div className="divide-y divide-send-line">
            <SummaryRow
              label="Transfer fee"
              value={preview ? preview.fee.formatted : "—"}
              sublabel="Flat, whatever you send"
              tone="accent"
            />
            <SummaryRow
              label="Exchange rate"
              value={preview ? preview.rateDisplay : "—"}
              sublabel={
                preview && preview.fxMarginBps === 0
                  ? "The rate we get. We add nothing to it."
                  : preview
                    ? `Includes a ${(preview.fxMarginBps / 100).toFixed(2)}% FX margin`
                    : undefined
              }
            />
            <SummaryRow
              label="Total you pay"
              value={preview ? preview.totalPayable.formatted : "—"}
              emphasis
            />
            <SummaryRow
              label="Estimated delivery"
              value={preview ? preview.estimatedDelivery : corridor.estimatedDelivery}
            />
          </div>
        )}

        <Link
          href={ctaHref}
          className="mt-4 flex min-h-[54px] w-full items-center justify-center rounded-xl bg-send-primary px-6 text-[16px] font-bold text-white transition hover:bg-send-primary-strong"
        >
          {ctaLabel}
        </Link>

        {preview?.isSandbox !== false && (
          <div className="mt-3 flex items-start gap-2">
            <SandboxBadge />
            <p className="text-[12px] leading-snug text-send-muted">
              Indicative rate from a sandbox provider, not a market rate. No money can move
              until a regulated provider is connected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function currencySymbol(code: string): string {
  const symbols: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", ZAR: "R" };
  return symbols[code] ?? code;
}
