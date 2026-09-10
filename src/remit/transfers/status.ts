/**
 * Transfer state machine.
 *
 * A transfer's status is derived from what providers and compliance actually
 * did. No API route accepts a status from a client, and every move goes through
 * `assertTransition`, which appends to the append-only event log.
 */

export const TRANSFER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAYMENT_RECEIVED",
  "COMPLIANCE_REVIEW",
  "CONVERTING",
  "SENT",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** Statuses a transfer can never leave. */
export const TERMINAL_STATUSES: readonly TransferStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

/**
 * Allowed moves. Anything not listed is rejected — including "backwards" moves,
 * which is what stops a replayed or out-of-order provider webhook from
 * un-completing a paid transfer.
 */
const TRANSITIONS: Record<TransferStatus, readonly TransferStatus[]> = {
  // Created, waiting for the customer's payment to be initiated.
  PENDING: ["PROCESSING", "COMPLIANCE_REVIEW", "FAILED", "CANCELLED"],
  // Payment initiated with the payment provider.
  PROCESSING: ["PAYMENT_RECEIVED", "COMPLIANCE_REVIEW", "FAILED", "CANCELLED"],
  // Funds confirmed received by the regulated payment provider.
  PAYMENT_RECEIVED: ["COMPLIANCE_REVIEW", "CONVERTING", "FAILED"],
  // Paused for a human compliance decision.
  COMPLIANCE_REVIEW: ["CONVERTING", "PROCESSING", "FAILED", "CANCELLED"],
  // FX executed with the FX provider.
  CONVERTING: ["SENT", "FAILED"],
  // Instruction handed to the payout network.
  SENT: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransferTransitionError extends Error {
  constructor(
    readonly from: TransferStatus,
    readonly to: TransferStatus,
  ) {
    super(`Cannot move a transfer from ${from} to ${to}`);
    this.name = "InvalidTransferTransitionError";
  }
}

export function assertTransition(from: TransferStatus, to: TransferStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransferTransitionError(from, to);
  }
}

export function isTerminal(status: TransferStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** A customer may only cancel before the money has been collected. */
export function isCancellable(status: TransferStatus): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

/**
 * The customer-facing timeline. Compliance review is only shown as its own step
 * once a transfer actually enters it — most transfers never do, and showing a
 * "compliance" step to everyone reads as a warning rather than reassurance.
 */
export interface TimelineStep {
  key: string;
  label: string;
  description: string;
  statuses: readonly TransferStatus[];
}

export const TIMELINE: readonly TimelineStep[] = [
  {
    key: "initiated",
    label: "Payment initiated",
    description: "We have your transfer and are collecting your payment.",
    statuses: ["PENDING", "PROCESSING"],
  },
  {
    key: "received",
    label: "Payment received",
    description: "Your payment has cleared with the payment provider.",
    statuses: ["PAYMENT_RECEIVED"],
  },
  {
    key: "compliance",
    label: "Compliance checks",
    description: "Required verification checks are being completed.",
    statuses: ["COMPLIANCE_REVIEW"],
  },
  {
    key: "converting",
    label: "Currency conversion",
    description: "Converting at the rate locked in your quote.",
    statuses: ["CONVERTING"],
  },
  {
    key: "sent",
    label: "Transfer sent",
    description: "Sent to the payout network in the destination country.",
    statuses: ["SENT"],
  },
  {
    key: "paid",
    label: "Recipient paid",
    description: "The money has reached your recipient.",
    statuses: ["COMPLETED"],
  },
];

export type TimelineState = "done" | "current" | "upcoming" | "skipped" | "stopped";

export interface TimelineEntry extends TimelineStep {
  state: TimelineState;
  at: Date | null;
}

/**
 * Build the timeline for a transfer from its real event history, so what the
 * customer sees is the audit trail rather than a guess.
 */
export function buildTimeline(
  status: TransferStatus,
  events: { toStatus: TransferStatus; createdAt: Date }[],
): TimelineEntry[] {
  const reached = new Map<TransferStatus, Date>();
  for (const event of events) {
    if (!reached.has(event.toStatus)) reached.set(event.toStatus, event.createdAt);
  }

  const enteredCompliance = reached.has("COMPLIANCE_REVIEW");
  const failed = status === "FAILED" || status === "CANCELLED";

  // FAILED and CANCELLED are not steps on the timeline — they are where a
  // transfer stopped. The step it stopped on is the last one it reached.
  const currentIndex = failed
    ? TIMELINE.reduce(
        (last, step, index) =>
          step.statuses.some((candidate) => reached.has(candidate)) ? index : last,
        0,
      )
    : TIMELINE.findIndex((step) => step.statuses.includes(status));

  return TIMELINE.filter((step) => step.key !== "compliance" || enteredCompliance).map((step) => {
    const at = step.statuses.map((s) => reached.get(s)).find(Boolean) ?? null;
    const index = TIMELINE.indexOf(step);
    let state: TimelineState;
    if (at && index !== currentIndex) state = "done";
    else if (index === currentIndex) state = failed ? "stopped" : "current";
    else if (failed && index > currentIndex) state = "skipped";
    else if (at) state = "done";
    else state = "upcoming";
    return { ...step, state, at };
  });
}

/** Short label for lists and badges. */
export const STATUS_LABELS: Record<TransferStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAYMENT_RECEIVED: "Payment received",
  COMPLIANCE_REVIEW: "In review",
  CONVERTING: "Converting",
  SENT: "Sent",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};
