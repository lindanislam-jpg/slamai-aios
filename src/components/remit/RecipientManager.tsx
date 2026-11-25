"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, EmptyState, SandboxBadge } from "./ui";
import { RecipientForm } from "./RecipientForm";
import type { Corridor, Recipient } from "./SendMoneyFlow";

/** Saved recipients: add, review and archive. */
export function RecipientManager({
  recipients: initial,
  corridors,
}: {
  recipients: Recipient[];
  corridors: Corridor[];
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [corridorId, setCorridorId] = useState(corridors[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const corridor = corridors.find((option) => option.id === corridorId) ?? corridors[0];

  async function archive(id: string) {
    setError(null);
    const response = await fetch(`/api/remit/recipients/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setError(data?.error?.message ?? "We could not remove that recipient");
      return;
    }
    setRecipients((current) => current.filter((recipient) => recipient.id !== id));
    router.refresh();
  }

  if (adding && corridor) {
    return (
      <Card className="space-y-4">
        <h2 className="text-[17px] font-bold text-send-ink">
          New recipient in {corridor.destination.name}
        </h2>

        {corridors.length > 1 && (
          <select
            value={corridorId}
            onChange={(event) => setCorridorId(event.target.value)}
            className="w-full rounded-xl border border-send-line bg-white px-4 py-3 text-[16px] font-semibold text-send-ink"
          >
            {corridors.map((option) => (
              <option key={option.id} value={option.id}>
                {option.destination.flag} {option.destination.name}
              </option>
            ))}
          </select>
        )}

        <RecipientForm
          countryCode={corridor.destination.countryCode}
          payoutMethod={corridor.payoutMethods[0] ?? "BANK_DEPOSIT"}
          onCancel={() => setAdding(false)}
          onCreated={(recipient) => {
            setRecipients((current) => [recipient, ...current]);
            setAdding(false);
            router.refresh();
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Button size="lg" className="w-full sm:w-auto" onClick={() => setAdding(true)}>
        + Add a recipient
      </Button>

      {recipients.length === 0 ? (
        <EmptyState
          title="No recipients saved"
          body="Add someone once and you can send to them in a couple of taps next time."
        />
      ) : (
        <ul className="space-y-2">
          {recipients.map((recipient) => (
            <li key={recipient.id}>
              <Card className="flex flex-wrap items-center gap-4">
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-send-primary/10 text-[16px] font-black text-send-primary"
                >
                  {recipient.fullName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-send-ink">
                    {recipient.nickname || recipient.fullName}
                  </div>
                  {recipient.nickname && (
                    <div className="truncate text-[12px] text-send-muted">
                      {recipient.fullName}
                    </div>
                  )}
                  <div className="mt-0.5 text-[12px] text-send-muted">
                    {String(recipient.maskedDetails.bankCode ?? "")} ·{" "}
                    {String(recipient.maskedDetails.accountNumber ?? "")} ·{" "}
                    {recipient.destCountryCode} {recipient.destCurrency}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => archive(recipient.id)}
                  className="rounded-lg px-3 py-2 text-[13px] font-semibold text-send-muted hover:bg-send-danger-soft hover:text-send-danger"
                >
                  Remove
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-send-muted">
        <SandboxBadge />
        Removing a recipient hides them from your list. Past transfers keep their original details,
        because record-keeping rules require it.
      </p>
    </div>
  );
}
