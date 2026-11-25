"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Alert, Button, Card, SandboxBadge, StatusPill, SummaryRow } from "./ui";

/**
 * Live transfer tracking.
 *
 * The timeline is rendered from the transfer's own event log, served by the
 * API. This component cannot set a status: it polls and displays. For sandbox
 * transfers it also pokes the simulator, which stands in for the provider
 * webhooks that would arrive in production and which run the same code.
 */

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  state: "done" | "current" | "upcoming" | "skipped" | "stopped";
  at: string | null;
}

interface StatusPayload {
  status: string;
  statusLabel: string;
  timeline: TimelineStep[];
  isDemo: boolean;
  failureReason: string | null;
  completedAt: string | null;
}

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"];

export function TransferTracker({
  transferId,
  initial,
  canCancel,
  demoMode,
  summary,
}: {
  transferId: string;
  initial: StatusPayload;
  canCancel: boolean;
  demoMode: boolean;
  summary: {
    reference: string;
    recipientName: string;
    sourceAmount: string;
    fee: string;
    totalPayable: string;
    destAmount: string;
    rateDisplay: string;
    estimatedDelivery: string;
    isSandbox: boolean;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finished = TERMINAL.includes(state.status);

  const poll = useCallback(async () => {
    // Sandbox transfers get nudged one step, exactly as a provider webhook
    // would. Live transfers only ever read.
    if (demoMode && state.isDemo && !TERMINAL.includes(state.status)) {
      await fetch(`/api/remit/transfers/${transferId}/simulate`, { method: "POST" }).catch(
        () => undefined,
      );
    }

    const response = await fetch(`/api/remit/transfers/${transferId}/status`);
    if (!response.ok) return;
    const data: StatusPayload = await response.json();
    setState(data);
  }, [demoMode, state.isDemo, state.status, transferId]);

  useEffect(() => {
    if (finished) {
      router.refresh();
      return;
    }
    const timer = setInterval(() => void poll(), 2500);
    return () => clearInterval(timer);
  }, [finished, poll, router]);

  async function cancel() {
    setCancelling(true);
    setError(null);
    const response = await fetch(`/api/remit/transfers/${transferId}/cancel`, { method: "POST" });
    const data = await response.json();
    setCancelling(false);
    if (!response.ok) {
      setError(data?.error?.message ?? "We could not cancel that transfer");
      return;
    }
    await poll();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-send-muted">
              {summary.reference}
            </div>
            <div className="tnum mt-1 text-[30px] font-black leading-none text-send-ink">
              {summary.destAmount}
            </div>
            <div className="mt-1.5 text-[14px] text-send-body">to {summary.recipientName}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={state.status} label={state.statusLabel} />
            {summary.isSandbox && <SandboxBadge />}
          </div>
        </div>

        {state.status === "COMPLETED" && (
          <div className="mt-4 rounded-xl bg-send-primary-soft px-4 py-3 text-[14px] font-semibold text-send-primary">
            {summary.recipientName} has been paid {summary.destAmount}.
          </div>
        )}

        {state.status === "FAILED" && state.failureReason && (
          <Alert tone="danger" title="This transfer could not be completed">
            {state.failureReason}
          </Alert>
        )}

        {state.status === "COMPLIANCE_REVIEW" && (
          <Alert tone="warning" title="Going through verification checks">
            This is routine and your rate is unchanged. We will email you as soon as it clears.
          </Alert>
        )}
      </Card>

      {/* --- Timeline ----------------------------------------------------- */}
      <Card>
        <h2 className="mb-4 text-[15px] font-bold text-send-ink">Progress</h2>
        <ol className="relative">
          {state.timeline.map((step, index) => {
            const last = index === state.timeline.length - 1;
            return (
              <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && (
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute left-[13px] top-7 h-[calc(100%-14px)] w-0.5 rounded",
                      step.state === "done" ? "bg-send-primary" : "bg-send-line",
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={clsx(
                    "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black",
                    step.state === "done" && "bg-send-primary text-white",
                    step.state === "current" &&
                      "bg-send-primary text-white ring-4 ring-send-primary/20",
                    step.state === "stopped" && "bg-send-danger text-white",
                    (step.state === "upcoming" || step.state === "skipped") &&
                      "bg-send-line text-send-muted",
                  )}
                >
                  {step.state === "done" ? "✓" : step.state === "stopped" ? "!" : index + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div
                    className={clsx(
                      "text-[14px] font-bold",
                      step.state === "upcoming" || step.state === "skipped"
                        ? "text-send-muted"
                        : "text-send-ink",
                    )}
                  >
                    {step.label}
                    {step.state === "current" && !finished && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-send-primary">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-send-primary" />
                        now
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] leading-relaxed text-send-body">
                    {step.description}
                  </div>
                  {step.at && (
                    <div className="tnum mt-0.5 text-[12px] text-send-muted">
                      {new Date(step.at).toLocaleString("en-IE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* --- What was agreed ---------------------------------------------- */}
      <Card>
        <h2 className="mb-1 text-[15px] font-bold text-send-ink">What you agreed</h2>
        <p className="mb-2 text-[12px] text-send-muted">
          These figures were locked when you confirmed and cannot change.
        </p>
        <div className="divide-y divide-send-line">
          <SummaryRow label="You sent" value={summary.sourceAmount} />
          <SummaryRow label="Transfer fee" value={summary.fee} tone="accent" />
          <SummaryRow label="Exchange rate" value={summary.rateDisplay} />
          <SummaryRow label="Recipient gets" value={summary.destAmount} tone="primary" />
          <SummaryRow label="Total charged" value={summary.totalPayable} emphasis />
          <SummaryRow label="Estimated delivery" value={summary.estimatedDelivery} />
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {canCancel && !finished && (
        <Button variant="secondary" className="w-full" onClick={cancel} disabled={cancelling}>
          {cancelling ? "Cancelling…" : "Cancel this transfer"}
        </Button>
      )}

      {demoMode && state.isDemo && !finished && (
        <p className="text-center text-[12px] leading-relaxed text-send-muted">
          Sandbox transfer — the provider webhooks are being simulated, so this progresses on its
          own. No money is moving.
        </p>
      )}
    </div>
  );
}
