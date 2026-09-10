"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, EmptyState, Field, inputClass } from "./ui";

/**
 * Compliance review queue.
 *
 * A rejection requires a written reason — the server enforces it too, because
 * "why was this stopped" is exactly the question a regulator asks later.
 */

export interface ReviewItem {
  id: string;
  reasons: string[];
  riskScore: number;
  createdAt: string;
  reference: string;
  sourceAmount: string;
  destAmount: string;
  recipientName: string;
  customerName: string;
  customerEmail: string;
  customerKyc: string;
}

export function ReviewQueue({ reviews: initial }: { reviews: ReviewItem[] }) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initial);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !notes[id]?.trim()) {
      setError("A rejection needs a reason for the record.");
      return;
    }
    setBusy(id);
    setError(null);

    const response = await fetch(`/api/remit/admin/reviews/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes: notes[id]?.trim() || undefined }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(data?.error?.message ?? "That decision could not be recorded");
      return;
    }
    setReviews((current) => current.filter((review) => review.id !== id));
    router.refresh();
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting"
        body="No transfers are currently held for a compliance decision."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {reviews.map((review) => (
        <Card key={review.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-send-muted">
                {review.reference}
              </div>
              <div className="tnum mt-1 text-[22px] font-black text-send-ink">
                {review.sourceAmount} → {review.destAmount}
              </div>
              <div className="mt-1 text-[13px] text-send-body">
                {review.customerName} ({review.customerEmail}) → {review.recipientName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase tracking-wide text-send-muted">
                Risk score
              </div>
              <div
                className={`tnum text-[26px] font-black ${
                  review.riskScore >= 70 ? "text-send-danger" : "text-send-warning"
                }`}
              >
                {review.riskScore}
              </div>
              <div className="text-[11px] text-send-muted">KYC: {review.customerKyc}</div>
            </div>
          </div>

          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-send-muted">
              Why it was flagged
            </div>
            <ul className="mt-1.5 space-y-1">
              {review.reasons.map((reason) => (
                <li key={reason} className="text-[13px] leading-relaxed text-send-body">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>

          <Field label="Decision notes" htmlFor={`notes-${review.id}`}>
            <textarea
              id={`notes-${review.id}`}
              rows={2}
              value={notes[review.id] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({ ...current, [review.id]: event.target.value }))
              }
              className={inputClass}
              placeholder="What you checked and what you concluded"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide(review.id, "APPROVE")} disabled={busy === review.id}>
              {busy === review.id ? "Recording…" : "Approve and continue"}
            </Button>
            <Button
              variant="danger"
              onClick={() => decide(review.id, "REJECT")}
              disabled={busy === review.id}
            >
              Reject transfer
            </Button>
          </div>

          <p className="text-[12px] leading-relaxed text-send-muted">
            Approving resumes the transfer from wherever it paused. Rejecting fails it and returns
            any funds collected. Either decision is written to the audit log against your account.
          </p>
        </Card>
      ))}
    </div>
  );
}
