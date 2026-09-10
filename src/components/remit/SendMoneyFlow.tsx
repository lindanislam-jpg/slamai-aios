"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Field, SandboxBadge, SummaryRow, inputClass } from "./ui";
import { RecipientForm } from "./RecipientForm";

/**
 * The send-money flow: amount → recipient → review → confirm.
 *
 * Three rules this component follows without exception:
 *   1. It performs no arithmetic. Every figure is rendered from the server.
 *   2. It never sends a fee, rate or total to the server.
 *   3. It generates one idempotency key per attempt, so a double-tap or a
 *      flaky connection cannot create a second transfer.
 */

interface MoneyDTO {
  currency: string;
  minor: string;
  amount: string;
  formatted: string;
}

interface Quote {
  id: string;
  sourceAmount: MoneyDTO;
  fee: MoneyDTO;
  totalPayable: MoneyDTO;
  destAmount: MoneyDTO;
  rateDisplay: string;
  fxMarginBps: number;
  estimatedDelivery: string;
  expiresAt: string;
  secondsRemaining: number;
  isSandbox: boolean;
}

export interface Recipient {
  id: string;
  nickname: string | null;
  fullName: string;
  destCountryCode: string;
  destCurrency: string;
  payoutMethod: string;
  maskedDetails: Record<string, unknown>;
}

export interface Corridor {
  id: string;
  source: { countryCode: string; name: string; flag: string; currency: string };
  destination: { countryCode: string; name: string; flag: string; currency: string };
  minAmount: MoneyDTO;
  maxAmount: MoneyDTO;
  paymentMethods: string[];
  payoutMethods: string[];
  isLive: boolean;
}

type Step = "amount" | "recipient" | "review";

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  DEBIT_CARD: "Debit card",
  CREDIT_CARD: "Credit card",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
};

export function SendMoneyFlow({
  corridors,
  recipients: initialRecipients,
  kycStatus,
}: {
  corridors: Corridor[];
  recipients: Recipient[];
  kycStatus: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("amount");
  const [corridor, setCorridor] = useState(corridors[0]);
  const [amount, setAmount] = useState("300");
  const [paymentMethod, setPaymentMethod] = useState(
    corridors[0]?.paymentMethods[0] ?? "BANK_TRANSFER",
  );
  const [recipients, setRecipients] = useState(initialRecipients);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [addingRecipient, setAddingRecipient] = useState(false);

  const [preview, setPreview] = useState<Quote | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewId = useRef(0);

  const eligibleRecipients = useMemo(
    () =>
      recipients.filter(
        (recipient) => recipient.destCountryCode === corridor?.destination.countryCode,
      ),
    [recipients, corridor],
  );

  // --- Live indicative pricing while the customer types --------------------
  const loadPreview = useCallback(
    async (value: string) => {
      if (!corridor || !/^\d{1,9}(\.\d{1,2})?$/.test(value)) {
        setPreview(null);
        return;
      }
      const id = ++previewId.current;
      const response = await fetch("/api/remit/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCountryCode: corridor.source.countryCode,
          destCountryCode: corridor.destination.countryCode,
          sourceAmount: value,
          paymentMethod,
          payoutMethod: corridor.payoutMethods[0] ?? "BANK_DEPOSIT",
        }),
      });
      const data = await response.json();
      if (id !== previewId.current) return;
      if (!response.ok) {
        setPreview(null);
        setError(data?.error?.message ?? null);
        return;
      }
      setError(null);
      setPreview({ ...data.preview, id: "preview" } as Quote);
    },
    [corridor, paymentMethod],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadPreview(amount), 300);
    return () => clearTimeout(timer);
  }, [amount, loadPreview]);

  // --- Quote countdown ------------------------------------------------------
  useEffect(() => {
    if (!quote) return;
    setSecondsLeft(quote.secondsRemaining);
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [quote]);

  const quoteExpired = Boolean(quote) && secondsLeft <= 0;

  async function requestQuote() {
    if (!corridor) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/remit/transfers/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceCountryCode: corridor.source.countryCode,
        destCountryCode: corridor.destination.countryCode,
        sourceAmount: amount,
        paymentMethod,
        payoutMethod: corridor.payoutMethods[0] ?? "BANK_DEPOSIT",
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data?.error?.message ?? "We could not price that transfer");
      return;
    }
    setQuote(data.quote);
    setStep("review");
  }

  async function confirmTransfer() {
    if (!quote || !recipientId) return;
    setBusy(true);
    setError(null);

    const response = await fetch("/api/remit/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: quote.id,
        recipientId,
        // One key per confirmation attempt. Retrying with the same key returns
        // the original transfer instead of creating a second one.
        idempotencyKey: `${quote.id}-${recipientId}`,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      if (data?.error?.details?.code === "QUOTE_EXPIRED") {
        setQuote(null);
        setStep("amount");
        setError("Your quote expired before you confirmed. Here is a fresh price.");
        return;
      }
      setError(data?.error?.message ?? "We could not create that transfer");
      return;
    }

    router.push(`/send/transactions/${data.transfer.id}`);
    router.refresh();
  }

  if (!corridor) {
    return (
      <Card>
        <Alert tone="warning">No sending routes are available right now.</Alert>
      </Card>
    );
  }

  const selectedRecipient = eligibleRecipients.find((recipient) => recipient.id === recipientId);

  return (
    <div className="space-y-4">
      <Steps current={step} />

      {error && <Alert tone="danger">{error}</Alert>}

      {kycStatus !== "APPROVED" && (
        <Alert tone="warning" title="Verification not complete">
          You can build a transfer now, but it will be held for review until your identity is
          verified.{" "}
          <Link href="/send/verify-identity" className="font-bold underline">
            Verify now
          </Link>
        </Alert>
      )}

      {/* --- Step 1: amount --------------------------------------------- */}
      {step === "amount" && (
        <Card className="space-y-5">
          <div>
            <label
              htmlFor="send-amount"
              className="block text-[12px] font-bold uppercase tracking-wide text-send-muted"
            >
              Send
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-send-line bg-send-canvas px-4 py-3 focus-within:border-send-primary focus-within:ring-2 focus-within:ring-send-primary/20">
              <span className="tnum text-[28px] font-bold text-send-ink">€</span>
              <input
                id="send-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="tnum w-full bg-transparent text-[34px] font-bold text-send-ink outline-none"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-send-muted">
              {corridor.minAmount.formatted} – {corridor.maxAmount.formatted} per transfer
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-send-line bg-white px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                From
              </div>
              <div className="mt-1 text-[15px] font-bold text-send-ink">
                {corridor.source.flag} {corridor.source.name}
              </div>
            </div>
            <div className="rounded-2xl border border-send-line bg-white px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                To
              </div>
              {corridors.length > 1 ? (
                <select
                  value={corridor.id}
                  onChange={(event) => {
                    const next = corridors.find((option) => option.id === event.target.value);
                    if (next) {
                      setCorridor(next);
                      setRecipientId(null);
                      setPaymentMethod(next.paymentMethods[0] ?? "BANK_TRANSFER");
                    }
                  }}
                  className="mt-1 w-full bg-transparent text-[15px] font-bold text-send-ink outline-none"
                >
                  {corridors.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.destination.flag} {option.destination.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 text-[15px] font-bold text-send-ink">
                  {corridor.destination.flag} {corridor.destination.name}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-send-primary-soft px-4 py-4">
            <div className="text-[12px] font-bold uppercase tracking-wide text-send-primary">
              Recipient gets
            </div>
            <div className="tnum mt-1 text-[34px] font-black leading-none text-send-primary">
              {preview ? preview.destAmount.formatted : "—"}
            </div>
          </div>

          <div className="divide-y divide-send-line">
            <SummaryRow
              label="Transfer fee"
              value={preview?.fee.formatted ?? "—"}
              tone="accent"
              sublabel="Flat, whatever you send"
            />
            <SummaryRow label="Exchange rate" value={preview?.rateDisplay ?? "—"} />
            <SummaryRow label="Total" value={preview?.totalPayable.formatted ?? "—"} emphasis />
            <SummaryRow
              label="Estimated delivery"
              value={preview?.estimatedDelivery ?? "—"}
            />
          </div>

          <Field label="Pay with" htmlFor="payment-method">
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className={inputClass}
            >
              {corridor.paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_LABELS[method] ?? method}
                </option>
              ))}
            </select>
          </Field>

          <Button
            size="lg"
            className="w-full"
            disabled={!preview}
            onClick={() => setStep("recipient")}
          >
            Continue
          </Button>
        </Card>
      )}

      {/* --- Step 2: recipient ------------------------------------------- */}
      {step === "recipient" && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-send-ink">Who is receiving it?</h2>
            <button
              type="button"
              onClick={() => setStep("amount")}
              className="text-[13px] font-semibold text-send-primary hover:underline"
            >
              Change amount
            </button>
          </div>

          {addingRecipient ? (
            <RecipientForm
              countryCode={corridor.destination.countryCode}
              payoutMethod={corridor.payoutMethods[0] ?? "BANK_DEPOSIT"}
              onCancel={() => setAddingRecipient(false)}
              onCreated={(recipient) => {
                setRecipients((current) => [recipient, ...current]);
                setRecipientId(recipient.id);
                setAddingRecipient(false);
              }}
            />
          ) : (
            <>
              {eligibleRecipients.length === 0 && (
                <Alert tone="info">
                  You have no saved recipients in {corridor.destination.name} yet.
                </Alert>
              )}

              <ul className="space-y-2">
                {eligibleRecipients.map((recipient) => (
                  <li key={recipient.id}>
                    <button
                      type="button"
                      onClick={() => setRecipientId(recipient.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                        recipientId === recipient.id
                          ? "border-send-primary bg-send-primary-soft"
                          : "border-send-line bg-white hover:border-send-primary/50"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-send-primary/10 text-[15px] font-black text-send-primary"
                      >
                        {recipient.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-send-ink">
                          {recipient.nickname || recipient.fullName}
                        </span>
                        <span className="block truncate text-[12px] text-send-muted">
                          {String(recipient.maskedDetails.bankCode ?? "")} ·{" "}
                          {String(recipient.maskedDetails.accountNumber ?? "")}
                        </span>
                      </span>
                      {recipientId === recipient.id && (
                        <span aria-hidden className="text-[16px] text-send-primary">
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setAddingRecipient(true)}
              >
                + Add a new recipient
              </Button>

              <Button
                size="lg"
                className="w-full"
                disabled={!recipientId || busy}
                onClick={requestQuote}
              >
                {busy ? "Getting your rate…" : "Review transfer"}
              </Button>
            </>
          )}
        </Card>
      )}

      {/* --- Step 3: review ----------------------------------------------- */}
      {step === "review" && quote && (
        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-bold text-send-ink">Check and confirm</h2>
            {quote.isSandbox && <SandboxBadge />}
          </div>

          <div className="rounded-2xl bg-send-ink px-5 py-5 text-white">
            <div className="text-[12px] font-bold uppercase tracking-wide text-white/60">
              {selectedRecipient?.fullName} receives
            </div>
            <div className="tnum mt-1 text-[36px] font-black leading-none">
              {quote.destAmount.formatted}
            </div>
            <div className="mt-3 text-[13px] text-white/60">
              {corridor.destination.flag} {corridor.destination.name} ·{" "}
              {String(selectedRecipient?.maskedDetails.accountNumber ?? "")}
            </div>
          </div>

          <div className="divide-y divide-send-line">
            <SummaryRow label="You send" value={quote.sourceAmount.formatted} />
            <SummaryRow label="Transfer fee" value={quote.fee.formatted} tone="accent" />
            <SummaryRow
              label="Exchange rate"
              value={quote.rateDisplay}
              sublabel={
                quote.fxMarginBps === 0
                  ? "The rate we get. We add nothing to it."
                  : `Includes a ${(quote.fxMarginBps / 100).toFixed(2)}% FX margin`
              }
            />
            <SummaryRow label="Estimated delivery" value={quote.estimatedDelivery} />
            <SummaryRow label="Total charged to you" value={quote.totalPayable.formatted} emphasis />
          </div>

          {quoteExpired ? (
            <Alert tone="warning" title="This price has expired">
              Rates move. Get a fresh quote — we will never change your amount without showing you.
            </Alert>
          ) : (
            <div className="rounded-xl bg-send-canvas px-4 py-3 text-center text-[13px] font-semibold text-send-body">
              This price is locked for{" "}
              <span className="tnum text-send-primary">{formatCountdown(secondsLeft)}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            {quoteExpired ? (
              <Button size="lg" className="w-full" onClick={requestQuote} disabled={busy}>
                Get a new price
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={confirmTransfer} disabled={busy}>
                {busy ? "Confirming…" : `Confirm and pay ${quote.totalPayable.formatted}`}
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setQuote(null);
                setStep("recipient");
              }}
              disabled={busy}
            >
              Back
            </Button>
          </div>

          {quote.isSandbox && (
            <p className="text-center text-[12px] leading-relaxed text-send-muted">
              Sandbox transfer. Confirming will move it through the real transfer states, but no
              money will be collected or paid out.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "amount", label: "Amount" },
    { key: "recipient", label: "Recipient" },
    { key: "review", label: "Review" },
  ];
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((step, index) => (
        <li key={step.key} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
              index <= currentIndex
                ? "bg-send-primary text-white"
                : "bg-send-line text-send-muted"
            }`}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            {index + 1}
          </span>
          <span
            className={`hidden text-[13px] font-semibold sm:inline ${
              index <= currentIndex ? "text-send-ink" : "text-send-muted"
            }`}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={`h-0.5 flex-1 rounded ${
                index < currentIndex ? "bg-send-primary" : "bg-send-line"
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
